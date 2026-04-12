import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AppViewer {
  authUserId: string;
  email: string;
  appUserId: string;
  organizationId: string;
  workspaceName: string;
  displayName: string;
  role: string;
}

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export function isAuthenticationRequiredError(error: unknown): error is AuthenticationRequiredError {
  return error instanceof AuthenticationRequiredError;
}

function toDisplayName(email: string) {
  const [localPart] = email.split("@");
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toWorkspaceLabel(value: string) {
  return value
    .split(/[.\-_]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

const publicEmailDomains = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com"
]);

function toWorkspaceName(email: string, userId: string) {
  const [, domain = "workspace.local"] = email.split("@");
  const baseName = publicEmailDomains.has(domain)
    ? `${toDisplayName(email)} Workspace`
    : `${toWorkspaceLabel(domain.split(".")[0] ?? "Workspace")} Workspace`;

  return `${baseName} ${userId.slice(0, 6)}`;
}

export const getOptionalViewer = cache(async (): Promise<AppViewer | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ supabaseAuthId: user.id }, { email: user.email }]
    }
  });

  const organization = existingUser
    ? await prisma.organization.findUnique({
        where: { id: existingUser.organizationId }
      })
    : await prisma.organization.create({
        data: {
          name: toWorkspaceName(user.email, user.id)
        }
      });

  if (!organization) {
    throw new Error("Viewer organization not found.");
  }

  const role = existingUser?.role
    ? existingUser.role
    : (await prisma.user.count({ where: { organizationId: organization.id } })) === 0
      ? "owner"
      : "member";

  const appUser = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email: user.email,
          organizationId: organization.id,
          supabaseAuthId: user.id,
          role
        }
      })
    : await prisma.user.create({
        data: {
          email: user.email,
          role,
          organizationId: organization.id,
          supabaseAuthId: user.id
        }
      });

  return {
    authUserId: user.id,
    email: user.email,
    appUserId: appUser.id,
    organizationId: organization.id,
    workspaceName: organization.name,
    displayName: metadataName || toDisplayName(user.email),
    role
  };
});

export async function requireViewer() {
  const viewer = await getOptionalViewer();
  if (!viewer) {
    throw new AuthenticationRequiredError();
  }

  return viewer;
}

export class AuthorizationError extends Error {
  constructor(message = "Not authorized.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function requireProcessMutationAccess(
  viewer: Pick<AppViewer, "appUserId" | "role">,
  createdBy: string
) {
  if (viewer.role === "owner" || viewer.appUserId === createdBy) {
    return;
  }

  throw new AuthorizationError("Not authorized to modify this process.");
}

export async function requirePageViewer(nextPath: string) {
  const viewer = await getOptionalViewer();
  if (!viewer) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return viewer;
}
