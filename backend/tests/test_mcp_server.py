import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch


_temp_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{(Path(_temp_dir.name) / 'test.db').as_posix()}"

from mcp import Client, StdioServerParameters
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from app.database import Base, SessionLocal, create_tables, engine
from app.main import app
from app.models.cover_letter import CoverLetter
from app.models.job import Job
from app.models.profile import Profile
from mcp_server import READ_ONLY, SAFE_WRITE, mcp


class MCPServerTest(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        _temp_dir.cleanup()

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        create_tables()
        with SessionLocal() as db:
            db.add(
                Profile(
                    full_name="Ada Candidate",
                    summary="Backend engineer",
                    skills=["Python", "SQL"],
                    experiences=[{"company": "Example", "title": "Engineer", "bullets": ["Built APIs"]}],
                    preferences={"roles": ["Backend Engineer"], "remote": True},
                )
            )
            db.add(
                Job(
                    title="Senior Backend Engineer",
                    company="Acme",
                    description="Build Python services.",
                    status="discovered",
                )
            )
            db.commit()

    def test_schema_expansion_preserves_jobs(self):
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE jobs DROP COLUMN category"))
            connection.execute(text("ALTER TABLE jobs DROP COLUMN priority"))
            connection.execute(text("ALTER TABLE jobs DROP COLUMN fit_analysis"))

        create_tables()

        columns = {column["name"] for column in inspect(engine).get_columns("jobs")}
        self.assertTrue({"category", "priority", "fit_analysis"}.issubset(columns))
        with engine.connect() as connection:
            self.assertEqual(connection.execute(text("SELECT title FROM jobs")).scalar_one(), "Senior Backend Engineer")

    def test_letter_source_migration_trusts_only_default_notes(self):
        with SessionLocal() as db:
            job_id = db.query(Job).first().id
            for version, feedback in enumerate(["Agent-authored draft", "Manual edit", "Shortened for recruiter"], 1):
                db.add(CoverLetter(job_id=job_id, version=version, content="Dear team", feedback=feedback))
            db.commit()
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE cover_letters DROP COLUMN source"))

        create_tables()

        with engine.connect() as connection:
            rows = connection.execute(text("SELECT feedback, source FROM cover_letters ORDER BY version")).all()
        self.assertEqual(
            rows,
            [("Agent-authored draft", "agent"), ("Manual edit", "manual"), ("Shortened for recruiter", "")],
        )

    def test_letter_source_recorded_per_creation_path(self):
        with TestClient(app) as client:
            created = client.post(
                "/api/jobs",
                json={
                    "title": "Data Engineer",
                    "company": "Example Labs",
                    "description": "Pipelines.",
                    "cover_letter": "Dear Example Labs,",
                    "cover_letter_source": "server",
                },
            ).json()
            letters = client.get("/api/cover-letters", params={"job_id": created["id"]}).json()
            manual = client.post(
                f"/api/cover-letters/{letters[0]['id']}/manual-version", json={"content": "Dear team,"}
            ).json()
            rejected = client.post(
                "/api/jobs",
                json={
                    "title": "Rejected",
                    "company": "Nowhere",
                    "description": "x",
                    "cover_letter": "Hi",
                    "cover_letter_source": "robot",
                },
            )
            titles = [job["title"] for job in client.get("/api/jobs").json()]

        self.assertEqual(letters[0]["source"], "server")
        self.assertEqual(manual["source"], "manual")
        self.assertEqual(rejected.status_code, 400)
        self.assertNotIn("Rejected", titles)

    def test_nudges_lists_applied_jobs_past_follow_up(self):
        with SessionLocal() as db:
            job = db.query(Job).first()
            job.status = "applied"
            job.next_follow_up = datetime.now(timezone.utc) - timedelta(days=1)
            db.commit()
        with TestClient(app) as client:
            response = client.get("/api/jobs/nudges")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([job["company"] for job in response.json()], ["Acme"])

    def test_resume_upload_stores_text_without_server_ai(self):
        with patch("app.routers.profile.server_ai_configured", return_value=False):
            with TestClient(app) as client:
                response = client.post(
                    "/api/profile/upload-resume",
                    data={"resume_text": "Ada Candidate\nBackend engineer"},
                )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["raw_resume_text"], "Ada Candidate\nBackend engineer")

    def test_profile_reports_resume_waiting_for_agent_parse(self):
        with SessionLocal() as db:
            profile = db.query(Profile).first()
            profile.full_name = ""
            profile.raw_resume_text = "Ada Candidate\nBackend engineer"
            db.commit()
        with TestClient(app) as client:
            self.assertTrue(client.get("/api/profile").json()["needs_parsing"])

    def test_tracker_events_feed_spans_jobs_newest_first(self):
        with TestClient(app) as client:
            created = client.post(
                "/api/jobs",
                json={"title": "Platform Engineer", "company": "Example Labs", "description": "Go services."},
            ).json()
            client.put(f"/api/jobs/{created['id']}", json={"status": "applied"})
            feed = client.get("/api/tracker/events", params={"limit": 5}).json()
            history = client.get("/api/tracker/events", params={"job_id": created["id"]}).json()

        self.assertEqual(feed[0]["to_status"], "applied")
        self.assertEqual(feed[0]["job_title"], "Platform Engineer")
        self.assertEqual(feed[0]["job_company"], "Example Labs")
        self.assertEqual([event["to_status"] for event in history], ["interested", "applied"])

    def test_capabilities_reports_server_ai_and_sources(self):
        with patch("app.services.capabilities.is_real_secret", return_value=False):
            with TestClient(app) as client:
                body = client.get("/api/meta/capabilities").json()
        self.assertFalse(body["server_ai"])
        self.assertIn("greenhouse", body["search_sources"])

    async def test_agent_workflow_tools_share_ui_data(self):
        async with Client(mcp, raise_exceptions=True) as client:
            profile = await client.call_tool(
                "save_profile_from_resume",
                {
                    "full_name": "Ada Candidate",
                    "email": "ada@example.test",
                    "phone": "+1 555 0100",
                    "location": "Remote",
                    "summary": "Backend engineer",
                    "skills": ["Python", "SQL"],
                    "experiences": [
                        {
                            "company": "Example",
                            "title": "Engineer",
                            "start_date": "2024",
                            "end_date": "Present",
                            "bullets": ["Built APIs"],
                        }
                    ],
                    "education": [],
                },
            )
            self.assertEqual(profile.structured_content["skills_count"], 2)

            private_context = await client.call_tool(
                "get_profile_context", {"include_resume_text": True}
            )
            self.assertNotIn("email", private_context.structured_content)

            provider_result = {
                "jobs": [
                    {
                        "external_id": "greenhouse-42",
                        "source": "greenhouse",
                        "title": "Python Platform Engineer",
                        "company": "Example Labs",
                        "location": "Remote",
                        "remote_type": "remote",
                        "description": "Build Python infrastructure.",
                        "url": "https://example.test/jobs/42",
                    }
                ],
                "errors": [],
            }
            with patch(
                "app.services.agent_workflows.JobSearchService.search_jobs",
                return_value=provider_result,
            ):
                searched = await client.call_tool("search_and_save_jobs", {"query": "Python"})
            self.assertEqual(searched.structured_content["count"], 1)

            listed = await client.call_tool("list_jobs", {})
            saved = next(job for job in listed.structured_content["jobs"] if job["company"] == "Example Labs")
            job_id = saved["id"]

            context = await client.call_tool("get_application_context", {"job_id": job_id})
            self.assertNotIn("email", context.structured_content["profile"])

            analyzed = await client.call_tool(
                "record_job_analysis",
                {
                    "job_id": job_id,
                    "fit_score": 8.5,
                    "category": "backend",
                    "priority": "high",
                    "match_reasons": ["Python experience"],
                    "gaps": ["No stated cloud experience"],
                    "summary": "Strong evidence-backed match.",
                },
            )
            self.assertEqual(analyzed.structured_content["category"], "backend")
            self.assertEqual(
                analyzed.structured_content["fit_analysis"],
                {
                    "reasons": ["Python experience"],
                    "gaps": ["No stated cloud experience"],
                    "summary": "Strong evidence-backed match.",
                },
            )
            with TestClient(app) as http:
                ui_job = http.get(f"/api/jobs/{job_id}").json()
            self.assertEqual(ui_job["fit_analysis"]["gaps"], ["No stated cloud experience"])

            letter = await client.call_tool(
                "save_cover_letter",
                {"job_id": job_id, "content": "Dear Acme,\n\nI build reliable Python services."},
            )
            self.assertEqual(letter.structured_content["version"], 1)
            self.assertEqual(letter.structured_content["source"], "agent")

            updated = await client.call_tool("update_job_status", {"job_id": job_id, "status": "interested"})
            self.assertEqual(updated.structured_content["status"], "interested")

    async def test_agent_derives_voice_profile_from_writing_samples(self):
        samples = [
            "Hi Sam,\n\nShort version: the migration shipped. Reach me at ada@example.test or +1 (555) 010-0200.",
            "I like small, boring releases.",
        ]
        with SessionLocal() as db:
            profile = db.query(Profile).first()
            profile.phone = "+1 555 010 0200"
            profile.writing_samples = samples
            db.commit()
            job_id = db.query(Job).first().id

        async with Client(mcp, raise_exceptions=True) as client:
            tools = {tool.name: tool for tool in (await client.list_tools()).tools}
            self.assertEqual(tools["get_writing_samples"].annotations, READ_ONLY)
            self.assertEqual(tools["save_voice_profile"].annotations, SAFE_WRITE)

            context = await client.call_tool("get_application_context", {"job_id": job_id})
            self.assertEqual(context.structured_content["profile"]["voice_profile"], "")
            self.assertEqual(context.structured_content["profile"]["writing_sample_count"], 2)
            self.assertNotIn("writing_samples", context.structured_content["profile"])

            masked = await client.call_tool("get_writing_samples", {})
            self.assertEqual(masked.structured_content["count"], 2)
            self.assertEqual(
                masked.structured_content["samples"][0],
                "Hi Sam,\n\nShort version: the migration shipped. Reach me at [email] or [phone].",
            )
            self.assertEqual(masked.structured_content["samples"][1], samples[1])
            raw = await client.call_tool("get_writing_samples", {"include_contact": True})
            self.assertEqual(raw.structured_content["samples"], samples)

            voice = "Direct and warm. Short sentences, plain words, dry humour."
            saved = await client.call_tool("save_voice_profile", {"voice_profile": f"  {voice}\n"})
            self.assertEqual(saved.structured_content["voice_profile"], voice)
            self.assertEqual(saved.structured_content["writing_sample_count"], 2)

            empty = await client.call_tool("save_voice_profile", {"voice_profile": "   "})
            self.assertTrue(empty.is_error)
            self.assertIn("empty", empty.content[0].text)
            too_long = await client.call_tool("save_voice_profile", {"voice_profile": "x" * 2001})
            self.assertTrue(too_long.is_error)
            self.assertIn("2000 characters", too_long.content[0].text)

            context = await client.call_tool("get_application_context", {"job_id": job_id})
            self.assertEqual(context.structured_content["profile"]["voice_profile"], voice)

        with TestClient(app) as http:
            ui_profile = http.get("/api/profile").json()
        self.assertEqual(ui_profile["voice_profile"], voice)
        self.assertEqual(ui_profile["writing_samples"], samples)

    async def test_anticipated_tool_errors_reach_the_agent(self):
        with SessionLocal() as db:
            job_id = db.query(Job).first().id
        provider_failure = {"jobs": [], "errors": ["jsearch: HTTP 401: invalid key"]}

        async with Client(mcp, raise_exceptions=True) as client:

            async def error_text(tool, arguments):
                result = await client.call_tool(tool, arguments)
                self.assertTrue(result.is_error, tool)
                return result.content[0].text

            self.assertIn(
                "status must be one of: applied, discovered, follow_up, interested, interview, offer, rejected",
                await error_text("update_job_status", {"job_id": job_id, "status": "ghosted"}),
            )
            self.assertIn("Job not found", await error_text("update_job_status", {"job_id": 999, "status": "applied"}))
            self.assertIn("Job not found", await error_text("get_application_context", {"job_id": 999}))
            self.assertIn(
                "fit_score must be between 0 and 10",
                await error_text(
                    "record_job_analysis",
                    {
                        "job_id": job_id,
                        "fit_score": 11,
                        "category": "backend",
                        "priority": "high",
                        "match_reasons": [],
                        "gaps": [],
                        "summary": "",
                    },
                ),
            )
            self.assertIn("Job not found", await error_text("save_cover_letter", {"job_id": 999, "content": "Hi"}))
            self.assertIn(
                "Cover letter content cannot be empty",
                await error_text("save_cover_letter", {"job_id": job_id, "content": "  "}),
            )
            with patch("app.services.agent_workflows.JobSearchService.search_jobs", return_value=provider_failure):
                self.assertIn(
                    "jsearch: HTTP 401: invalid key",
                    await error_text("search_and_save_jobs", {"query": "Python", "sources": ["jsearch"]}),
                )
            self.assertIn(
                "experiences.0.bullets",
                await error_text(
                    "save_profile_from_resume",
                    {
                        "full_name": "Ada Candidate",
                        "email": "",
                        "phone": "",
                        "location": "",
                        "summary": "",
                        "skills": [],
                        "experiences": [{"company": "Example", "bullets": "Built APIs"}],
                        "education": [],
                    },
                ),
            )

            # A LookupError subclass from a bug is a crash: its text stays in the server log.
            with patch("mcp_server.set_job_status", side_effect=KeyError("internal detail")):
                with self.assertLogs(level="ERROR"):
                    crashed = await error_text("update_job_status", {"job_id": job_id, "status": "applied"})
            self.assertEqual(crashed, "Error executing tool update_job_status")

            with SessionLocal() as db:
                db.query(Profile).delete()
                db.commit()
            self.assertIn("Profile not found", await error_text("get_profile_context", {}))

    async def test_stdio_entrypoint_lists_expected_tools(self):
        backend_dir = Path(__file__).resolve().parents[1]
        params = StdioServerParameters(
            command=sys.executable,
            args=[str(backend_dir / "mcp_server.py")],
            cwd=backend_dir,
        )
        async with Client(params, raise_exceptions=True) as client:
            tools = await client.list_tools()
            names = {tool.name for tool in tools.tools}
            self.assertTrue(
                {
                    "search_and_save_jobs",
                    "get_application_context",
                    "save_profile_from_resume",
                    "record_job_analysis",
                    "save_cover_letter",
                    "get_writing_samples",
                    "save_voice_profile",
                }.issubset(names)
            )


if __name__ == "__main__":
    unittest.main()
