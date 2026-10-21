import { OrderDetailPage } from "@/components/admin/orders/detail/OrderDetailPage";

export default async function AdminOrderDetailRoute({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return <OrderDetailPage orderNumber={decodeURIComponent(orderNumber)} />;
}
