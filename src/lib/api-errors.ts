import { NextResponse } from "next/server";

import { isAuthenticationRequiredError, isAuthorizationError } from "@/lib/auth";

export function errorResponse(
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 400
) {
  if (isAuthenticationRequiredError(error)) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (isAuthorizationError(error)) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json(
    { error: fallbackMessage },
    { status: fallbackStatus }
  );
}
