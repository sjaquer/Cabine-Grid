import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role, locationId } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // 1. Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Set Custom Claims for role
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // 3. Create document in Firestore "users" collection
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name,
      role,
      locationIds: locationId && locationId !== "__none" ? [locationId] : [],
      permissions: [],
      isActive: true,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Error al crear usuario en /api/users:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}
