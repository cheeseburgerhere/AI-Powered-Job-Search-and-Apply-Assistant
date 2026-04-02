# AI Job Assistant: Desktop App Guide

This guide explains how to compile the AI Job Assistant into a standalone standalone desktop application and how to run it.

##  1. Building the App

We have created an automated script that compiles the Python backend and wraps the React frontend into an Electron application.

1. Open your terminal.
2. Navigate to the project root:
   ```bash
   cd <folder_route>/ai-job-assistant
   ```
3. Run the master build script:
   ```bash
   ./build_desktop.sh
   ```

**What this script does:**
- It creates a Python virtual environment and installs the backend dependencies.
- It uses PyInstaller to compile the FastAPI backend into a single executable (`ai-job-backend`).
- It installs the frontend NPM dependencies.
- It uses `electron-builder` to package the React frontend and link it to the backend executable.

### Build Outputs
Once the script finishes, your built application will be located in the `frontend/release/` directory.
- **On Linux:** You will see an `.AppImage` file.
- **On Windows:** You will see a `Setup.exe` file.
- **On Mac:** You will see a `.dmg` file.

> **Note on Windows Cross-compiling:** If you are running the build script on Linux but want to generate a Windows `.exe`, you must have `wine` installed on your Linux machine. Then, run `cd frontend && npx electron-builder --win` manually.

---

##  2. Getting Started (For End Users)

When you or someone else runs the application for the first time, here is what to expect:

1. **Install/Launch:** Double-click the installer or AppImage. The application window will open smoothly.
2. **First Run Setup:** 
   - Behind the scenes, the application will automatically create a hidden configuration folder in your home directory: `~/.ai-job-assistant/`.
   - It will place a blank `.env` file inside this folder if one doesn't exist.
   - It will also create a `data/app.db` file here to store all of your job data safely away from the installation directory.
3. **Adding API Keys:**
   - Out of the box, you'll need to provide your API keys to use the AI features.
   - Go to your home directory (`C:\Users\YourName` on Windows, or `~` on Mac/Linux) and open the hidden `.ai-job-assistant/` folder.
   - Open `.env` in any text editor and fill out your keys (e.g., `GEMINI_API_KEY=your_key`).
   - Restart the desktop app for the keys to take effect!

---

##  3. Developing Features

If you want to continue editing code while the Electron wrapper is active:

- **Run Dev Mode:** Open a terminal in the `frontend` folder and run:
  ```bash
  npm run electron:dev
  ```
  This will open the Desktop App window but it will hot-reload your React code whenever you save a file. (The Python backend must still be running in a separate terminal on port 8000 for dev mode API calls to succeed).

##  Troubleshooting

- **App loads but UI says "Network Error":** Ensure that no other background process is blocking the app from reserving a free network port.
- **Changes in `.env` not showing up:** Make sure you edit `.env` in `~/.ai-job-assistant/.env`, NOT the one inside the source code directory! The desktop app completely ignores the source code `.env`.
