import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const products = await prisma.product.findMany({
            orderBy: { id: 'asc' },
        });

        const formattedProducts = products.map(product => {
            // Compute status based on stock
            let status = 'in_stock';
            if (product.stock === 0) status = 'out_of_stock';
            else if (product.stock <= 5) status = 'low_stock';

            return {
                ...product,
                id: String(product.id),
                status,
                currency: 'USD', // Default
                lowStockThreshold: 5, // Default
                rating: product.rating || 0,
                reviewCount: 0, // Mock for now or derived from elsewhere
                returnable: true,
                createdAt: new Date().toISOString(), // Mock if missing
                updatedAt: new Date().toISOString(),
            };
        });

        return NextResponse.json(formattedProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
