import { spawnSync } from 'node:child_process';

// VITE_* values are public and compiled into the app. Never put server secrets here.
const apiBase = new URL(process.env.IOS_API_BASE_URL || 'https://app.slovakgo.sk/api');
if (apiBase.protocol !== 'https:' || apiBase.username || apiBase.password || apiBase.search || apiBase.hash) {
  throw new Error('IOS_API_BASE_URL must be an HTTPS API URL without credentials, query or fragment.');
}

const mode = process.env.IOS_UI_TEST === '1' ? 'native-test' : 'native';
const pushEnvironment = process.env.IOS_PUSH_ENVIRONMENT || 'sandbox';
if (!['sandbox', 'production'].includes(pushEnvironment)) throw new Error('IOS_PUSH_ENVIRONMENT must be sandbox or production');
const result = spawnSync('npm', ['run', 'build', '--', '--mode', mode, '--outDir', 'dist-native'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_BASE_URL: apiBase.href.replace(/\/$/, ''),
    VITE_NATIVE_PUSH_ENABLED: process.env.IOS_PUSH_ENABLED === '1' ? 'true' : 'false',
    VITE_NATIVE_PUSH_ENVIRONMENT: pushEnvironment,
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
