import { CustomerTabBar, CustomerTopNav } from "@/components/customer/customer-nav";

/**
 * The customer shell, ported from `CustomerHome`'s `Scaffold`
 * (`tho/app/lib/customer/customer_home.dart:219`).
 *
 * The nav is the only shared chrome. Discover and the salon page render their own
 * headers, exactly as the app does — `customer_home.dart:222` drops the AppBar on
 * the first two tabs because each has its own.
 *
 * The bottom bar is fixed, so the main region reserves its height plus the safe-area
 * inset; above 744 the bar is gone and that padding comes off.
 */
export default function CustomerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col">
      <CustomerTopNav />
      <main className="flex-1 pb-[calc(62px+env(safe-area-inset-bottom))] tablet:pb-0">
        {children}
      </main>
      <CustomerTabBar />
    </div>
  );
}
