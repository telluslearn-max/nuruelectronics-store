import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExUkConversation } from "@/components/ex-uk/ex-uk-conversation";
import { ExUkTopBar } from "@/components/ex-uk/ex-uk-top-bar";
import { getProductByHandle } from "@/lib/shopify";

type ConversationPageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: ConversationPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  return { title: product?.title ?? "Conversation" };
}

export default async function ExUkConversationPage({ params }: ConversationPageProps) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) notFound();

  return (
    <>
      <ExUkTopBar title={product.title} />
      <ExUkConversation product={product} />
    </>
  );
}
