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
            out_file: '/var/log/img-manager/api-out.log',
            error_file: '/var/log/img-manager/api-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            time: true,
        },
    ],
};
