import connectDBm from "@/config/dbm";
import User from "@/models/User";
import Product from "@/models/Product";
import Order from "@/models/Order";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";



export async function POST(request) {
    try {
        
        const { userId } = getAuth(request)
        const { address, items } = await request.json()

        if (!address || items.length === 0) {
            return NextResponse.json({ success: false, message: 'Invalid data' })
        }

        // Calculating amount using items
        const amount = await items.reduce(async (acc, item) => {
            const product = await Product.findById(item.product)
            return await acc + (product.offerPrice * item.quantity)
        },0)
        const finalAmount = amount + Math.floor(amount * 0.02);

        await connectDBm();
        await Order.create({
            userId,
            address,
            items,
            amount: finalAmount,
            date: Date.now(),
        });

        // Clearing user's cart 
        const user = await User.findById(userId)
        user.cartItems = {}
        await user.save()

        return NextResponse.json({ success: true, message: 'Order Placed' })

    } catch (error) {
        console.log(error)
        return NextResponse.json({ success: false, message: error.message })
    }
}