import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const body = await request.json();
  const { email, password, nom_utilisateur, role, organization_id } = body as {
    email?: string;
    password?: string;
    nom_utilisateur?: string;
    role?: string;
    organization_id?: string;
  };

  if (!email || !password || !nom_utilisateur || !role || !organization_id) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, secretKey);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Échec de la création du compte." },
      { status: 400 }
    );
  }

  const newUserId = created.user.id;

  // L'insertion du profil passe par le client de l'appelant (son propre jeton),
  // pour que ce soit la policy RLS "Creation de comptes par ADMIN_N1 ou ADMIN_SITE"
  // qui fasse foi sur qui a le droit de créer quel rôle — pas une logique dupliquée ici.
  const asCaller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { error: profileError } = await asCaller.from("profiles").insert({
    id: newUserId,
    organization_id,
    nom_utilisateur,
    role,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: profileError.message }, { status: 403 });
  }

  return NextResponse.json({ id: newUserId });
}
