import type { Metadata } from "next";
import { WishlistSection } from "@/components/wishlist/wishlist-section";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <div>
      <h1 className="text-title">Wishlist</h1>
      <div className="mt-8">
        <WishlistSection />
      </div>
    </div>
  );
}
