module.exports = {
    apps: [
        {
            name: 'service-platform-api',
            script: 'dist/src/main.js',
            out_file: 'out.log',
            error_file: 'err.log',
            instance_var: 'api',
        },
    ],
};
