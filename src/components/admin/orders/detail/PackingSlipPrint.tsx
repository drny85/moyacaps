import type { OrderDetailVM } from "@/lib/admin/orderDetail";

/** Print-only packing slip (window.print()): one page the packer ticks through. */
export function PackingSlipPrint({ vm, statusLine }: { vm: OrderDetailVM; statusLine: string }) {
  return (
    <div className="hidden print:block p-8 font-sans text-black bg-white max-w-3xl mx-auto">
      <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black tracking-tight">GOOD LUCK</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600 font-mono mt-0.5">Packing slip</p>
        </div>
        <div className="text-right font-mono text-xs">
          <p className="font-bold text-sm">{vm.header.orderNumber}</p>
          <p className="text-gray-600">{vm.header.placedLabel}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
        <div>
          <h3 className="font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-300 pb-1">Ship to</h3>
          {vm.shipTo.name && <p className="font-bold text-sm">{vm.shipTo.name}</p>}
          {vm.shipTo.phone && <p className="font-mono">{vm.shipTo.phone}</p>}
          <div className="mt-1 space-y-0.5 font-mono">{vm.shipTo.lines.map((l, i) => <p key={i}>{l}</p>)}</div>
        </div>
        <div>
          <h3 className="font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-300 pb-1">Shipping</h3>
          <p><strong>Carrier:</strong> {vm.labels.carrier ?? "—"}</p>
          <p className="font-mono"><strong>Tracking:</strong> {vm.labels.trackingNumber ?? "—"}</p>
          <p><strong>Status:</strong> {statusLine}</p>
          {vm.notes && <div className="mt-2 p-2 bg-gray-100 rounded text-[11px] font-mono"><strong>Notes:</strong> {vm.notes}</div>}
        </div>
      </div>
      <table className="w-full text-left text-xs border-collapse mb-6">
        <thead>
          <tr className="border-b-2 border-black font-mono uppercase text-[10px]">
            <th className="py-2 w-10 text-center">✓</th>
            <th className="py-2">Item</th>
            <th className="py-2 w-32">Colorway · size</th>
            <th className="py-2 w-28">Slug</th>
            <th className="py-2 w-12 text-center">Qty</th>
            <th className="py-2 text-right w-20">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {vm.items.map((line) => (
            <tr key={line.key}>
              <td className="py-3 text-center"><span className="inline-block w-4 h-4 border-2 border-black rounded-xs" /></td>
              <td className="py-3 font-semibold">{line.name}</td>
              <td className="py-3">{line.colorway ? `${line.colorway}${line.size ? ` · ${line.size}` : ""}` : "—"}</td>
              <td className="py-3 font-mono text-gray-600">{line.slug}</td>
              <td className="py-3 text-center font-bold text-base">{line.quantity}</td>
              <td className="py-3 text-right font-mono">{line.lineLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t-2 border-black pt-3 flex justify-end">
        <div className="w-64 space-y-1 text-xs">
          {vm.money.subtotalLabel && <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-mono">{vm.money.subtotalLabel}</span></div>}
          {vm.money.shippingLabel && <div className="flex justify-between"><span className="text-gray-600">Shipping</span><span className="font-mono">{vm.money.shippingLabel === "free" ? "FREE" : vm.money.shippingLabel}</span></div>}
          {vm.money.taxLabel && <div className="flex justify-between"><span className="text-gray-600">Tax</span><span className="font-mono">{vm.money.taxLabel}</span></div>}
          <div className="flex justify-between font-bold text-sm border-t border-black pt-1"><span>{vm.money.paid ? "Total paid" : "Total due"}</span><span className="font-mono">{vm.money.totalLabel}</span></div>
        </div>
      </div>
    </div>
  );
}
