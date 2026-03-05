module.exports = {
  apps: [
    {
      name: "turion-web",
      cwd: "./apps/web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      instances: 2,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "turion-api",
      cwd: "./apps/api",
      script: "venv/bin/uvicorn",
      interpreter: "none",
      args: "main:app --host 0.0.0.0 --port 8000 --workers 4",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
  ],
};
