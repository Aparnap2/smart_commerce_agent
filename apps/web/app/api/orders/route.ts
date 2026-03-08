import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        // Look up the customer by email
        const customer = await prisma.customer.findUnique({
            where: { email: session.user.email },
        });

        if (!customer) {
            return NextResponse.json([]);
        }

        const orders = await prisma.order.findMany({
            where: { customerId: customer.id },
            include: {
                product: true,
            },
            orderBy: { orderDate: 'desc' },
        });

        // Map Prisma models to the expected OrderData type if necessary
        const formattedOrders = orders.map(order => ({
            id: String(order.id),
            orderNumber: order.trackingNumber || `ORD-${order.id}`,
            status: order.status,
            total: order.total,
            subtotal: order.total, // Simplified
            tax: 0,
            shipping: 0,
            items: [
                {
                    id: String(order.productId),
                    name: order.product.name,
                    quantity: order.quantity,
                    price: order.product.price,
                    sku: order.product.sku || '',
                }
            ],
            createdAt: order.orderDate.toISOString(),
            updatedAt: order.orderDate.toISOString(),
            customerEmail: session.user.email,
        }));

        return NextResponse.json(formattedOrders);
    } catch (error) {
        console.error("Error fetching orders:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
