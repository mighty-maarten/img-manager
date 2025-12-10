const fs = require('fs');
const path = require('path');

// Read and parse .env.production file
const envFile = fs.readFileSync('/opt/img-manager/shared/.env.production', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
            envVars[key.trim()] = valueParts.join('=').trim();
        }
    }
});

module.exports = {
    apps: [
        {
            name: 'img-manager-api',
            script: 'packages/api/dist/src/main.js',
            cwd: '/opt/img-manager/current',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                ...envVars,
                NODE_PATH: '/opt/img-manager/current/node_modules',
            },
            out_file: '/var/log/img-manager/api-out.log',
            error_file: '/var/log/img-manager/api-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true,
        },
    ],
};
