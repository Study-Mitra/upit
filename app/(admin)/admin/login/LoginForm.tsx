'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const INITIAL: LoginState = { error: null };

/**
 * A Client Component so `useActionState` can render the validation error inline
 * instead of round-tripping through a query parameter.
 */
export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <form action={formAction}>
      {state.error ? (
        <p className="a-msg a-msg-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="next" value={next} />

      <div className="a-field">
        <label htmlFor="email">Email</label>
        <input
          className="a-input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div className="a-field">
        <label htmlFor="password">Password</label>
        <input
          className="a-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button
        className="a-btn a-btn-primary"
        type="submit"
        disabled={pending}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
