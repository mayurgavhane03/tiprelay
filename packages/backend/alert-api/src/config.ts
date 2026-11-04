import 'dotenv/config';
export function configuration(env = process.env) {
  const aws = !!(
    env.AWS_LAMBDA_FUNCTION_NAME ||
    env.AWS_EXECUTION_ENV ||
    env.APP_ENV === 'production' ||
    env.APP_ENV === 'development'
  );
  const bypass = env.LOCAL_AUTH_BYPASS === 'true';
  const host = env.HOST || '127.0.0.1';
  if (bypass && (aws || host !== '127.0.0.1' || env.APP_ENV !== 'local'))
    throw new Error('Local authentication bypass is forbidden in this runtime');
  if (!aws && !bypass)
    throw new Error('Local runtime requires explicit APP_ENV=local and LOCAL_AUTH_BYPASS=true');
  return {
    aws,
    bypass,
    host,
    port: Number(env.PORT || 3001),
    origin: env.WEB_ORIGIN || 'http://127.0.0.1:5173',
  };
}
