import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

const initSentry = () => {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  // Only initialize Sentry if we have a valid DSN (not the placeholder)
  if (import.meta.env.PROD && sentryDsn && sentryDsn !== 'https://your-dsn@sentry.io/project-id') {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [new BrowserTracing()],
      tracesSampleRate: 1.0,
      environment: 'production',
      beforeSend(event) {
        if (event.exception && import.meta.env.DEV) {
          console.error('Sentry captured error:', event.exception);
        }
        return event;
      },
    });
  }
};

export default initSentry;