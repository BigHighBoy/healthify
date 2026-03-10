import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import connectDBm from "@/config/dbm";
import User from "@/models/User";

export async function POST(request) {
    const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!SIGNING_SECRET) {
        return NextResponse.json(
            { success: false, message: "Missing CLERK_WEBHOOK_SECRET environment variable" },
            { status: 500 }
        );
    }

    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return NextResponse.json(
            { success: false, message: "Missing svix headers" },
            { status: 400 }
        );
    }

    const body = await request.text();
    const wh = new Webhook(SIGNING_SECRET);

    let evt;
    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        });
    } catch (err) {
        return NextResponse.json(
            { success: false, message: "Invalid webhook signature" },
            { status: 400 }
        );
    }

    const { type, data } = evt;

    await connectDBm();

    if (type === "user.created") {
        const { id, first_name, last_name, email_addresses, image_url } = data;
        await User.create({
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + " " + last_name,
            imageUrl: image_url,
        });
    } else if (type === "user.updated") {
        const { id, first_name, last_name, email_addresses, image_url } = data;
        await User.findByIdAndUpdate(id, {
            email: email_addresses[0].email_address,
            name: first_name + " " + last_name,
            imageUrl: image_url,
        });
    } else if (type === "user.deleted") {
        const { id } = data;
        await User.findByIdAndDelete(id);
    }

    return NextResponse.json({ success: true });
}
