'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Star, Search, Package } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { OrderCard, ProductCard, type OrderData, type ProductData } from './dashboard/components/genui';
import { useCopilotAction } from "@copilotkit/react-core";
import { ClientOnly } from "@/components/client-only";

// Dynamically import CopilotChat to avoid SSR hydration errors
const CopilotChat = dynamic(
  () => import("@copilotkit/react-ui").then((mod) => mod.CopilotChat),
  { ssr: false }
);

type TabType = 'products' | 'order' | 'recommendations';


import { useSession, signOut } from "next-auth/react";
import { LogOut, User as UserIcon, Loader2 } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { data: session, status } = useSession();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  // Real data fetching
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<ProductData[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const resp = await fetch('/api/products');
      if (!resp.ok) throw new Error('Failed to fetch products');
      return resp.json();
    },
    enabled: status === 'authenticated',
  });

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery<OrderData[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const resp = await fetch('/api/orders');
      if (!resp.ok) throw new Error('Failed to fetch orders');
      return resp.json();
    },
    enabled: status === 'authenticated',
  });

  useCopilotAction({
    name: "get_products",
    description: "Displays a list of products to the user.",
    available: "remote",
    parameters: [],
    render: ({ result, status }) => {
      if (status === 'inProgress' || status === 'executing') {
        return (
          <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm mt-2">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
            <p className="text-sm text-gray-500 font-medium">Searching catalog...</p>
          </div>
        );
      }
      if (result?.products && Array.isArray(result.products)) {
        return (
          <div className="flex overflow-x-auto gap-4 mt-2 pb-4 snap-x">
            {result.products.map((product: any) => (
              <div key={product.id} className="min-w-[280px] snap-center">
                <ProductCard
                  product={product}
                  onAddToCart={() => toast.success(`Added ${product.name} to cart!`)}
                />
              </div>
            ))}
          </div>
        );
      }
      return null;
    }
  });

  useCopilotAction({
    name: "get_orders",
    description: "Displays the user's order history.",
    available: "remote",
    parameters: [],
    render: ({ result, status }) => {
      if (status === 'inProgress' || status === 'executing') {
        return (
          <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm mt-2">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
            <p className="text-sm text-gray-500 font-medium">Retrieving your orders...</p>
          </div>
        );
      }
      if (result?.orders && Array.isArray(result.orders)) {
        return (
          <div className="space-y-4 mt-2">
            {result.orders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={order}
                onViewDetails={() => toast.info(`Viewing order ${order.orderNumber}`)}
              />
            ))}
          </div>
        );
      }
      return null;
    }
  });

  useCopilotAction({
    name: "add_to_cart",
    description: "Adds a specific product to the user's shopping cart.",
    available: "remote",
    parameters: [],
    render: ({ result, status }) => {
      if (status === 'inProgress' || status === 'executing') {
        return (
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2 mt-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Adding to cart...</p>
          </div>
        );
      }
      if (result?.success) {
        return (
          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2 mt-2">
            <span className="text-green-600">✅</span>
            <p className="font-medium text-sm text-green-800 dark:text-green-300">{result.message}</p>
          </div>
        );
      }
      return null;
    }
  });

  const filteredProducts = products.filter(
    (product) =>
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'products', label: 'Products', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'order', label: 'My Order', icon: <Package className="w-4 h-4" /> },
    { id: 'recommendations', label: 'For You', icon: <Star className="w-4 h-4" /> },
  ];

  if (!isClient) return null;

  return (
    <ClientOnly>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col" style={{ maxHeight: '100vh', overflow: 'hidden' }}>
        <Toaster position="top-center" />

        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-md flex-shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">TechTrend</h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  className="px-4 py-2 rounded-full text-sm text-gray-800 w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
              <div className="flex items-center gap-3">
                {session?.user && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mr-2">
                    <div className="flex flex-col items-end">
                      <p className="text-sm font-medium">{session?.user?.name || session?.user?.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{session?.user?.role || 'Guest'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                      <UserIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: '/auth/login' })}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Sign Out"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Welcome back, {session?.user?.name || 'Shopper'}!</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Active Member</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">Exclusive Perks</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Latest Orders</p>
                <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">{orders.length} Completed</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Cart Status</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">Items Waiting</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <nav className="flex justify-center space-x-1 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition ${activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Content for Tabs */}
          <div className="py-6 min-h-[400px]">
            {isLoadingProducts || isLoadingOrders ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-gray-500">Loading catalog...</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {filteredProducts.map((product) => (
                      <ProductCard key={product.id} product={product} onAddToCart={() => toast.success(`Added ${product.name} to cart!`)} />
                    ))}
                  </motion.div>
                )}

                {activeTab === 'order' && (
                  <motion.div
                    key="order"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {orders.length > 0 ? (
                      orders.map((order) => (
                        <OrderCard key={order.id} order={order} onViewDetails={() => toast.info(`Viewing details for ${order.orderNumber}`)} />
                      ))
                    ) : (
                      <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl border border-gray-200 dark:border-gray-700 text-center">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No orders found</h3>
                        <p className="text-gray-500 mt-1">Start shopping to see your order history!</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'recommendations' && (
                  <motion.div
                    key="recommendations"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {products.slice(0, 3).map((product) => (
                      <ProductCard key={`rec-${product.id}`} product={product} onAddToCart={() => toast.success(`Added ${product.name} to cart!`)} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Copilot Chat Window */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              className="fixed bottom-4 right-4 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col z-50 border border-gray-200 dark:border-gray-700"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-gradient-to-r from-blue-700 to-indigo-600 text-white p-4 flex justify-between items-center rounded-t-2xl flex-shrink-0">
                <h3 className="font-bold text-lg">Smart Commerce Agent</h3>
                <button onClick={() => setIsChatOpen(false)} className="text-xl p-1 hover:bg-white/20 rounded-full">
                  <Package size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CopilotChat
                  instructions="You are TechTrend Support Assistant. Help users find products and check order status."
                  labels={{
                    title: "Smart Agent",
                    initial: "Welcome! Ask me about products or your order history.",
                    placeholder: "Type a message...",
                  }}
                  className="h-full"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isChatOpen && (
          <motion.button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </motion.button>
        )}
      </main>
    </ClientOnly >
  );
}
