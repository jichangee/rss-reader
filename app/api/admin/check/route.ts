import { NextResponse } from "next/server"
import { checkAdmin } from "@/lib/admin"

export async function GET() {
  try {
    const admin = await checkAdmin()
    return NextResponse.json({ 
      isAdmin: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    })
  } catch (error) {
    return NextResponse.json({ isAdmin: false }, { status: 403 })
  }
}
