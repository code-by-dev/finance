import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { AddTransactionForm } from "../_components/transaction-form";
import { getTransaction } from "@/actions/transaction";
import { headers } from "next/headers";

export default async function AddTransactionPage() {
  const accounts = await getUserAccounts();
  
   // Step 2: Read query params using headers
  const headersList = await headers();
  const currentUrl = headersList.get("x-next-url") || "/";
  const url = new URL(currentUrl, "http://localhost"); // base URL required
  const editId = url.searchParams.get("edit");

  let initialData = null;
  if (editId) {
    const transaction = await getTransaction(editId);
    initialData = transaction;
  }

  return (
    <div className="max-w-3xl mx-auto px-5">
      <div className="flex justify-center md:justify-normal mb-8">
        <h1 className="text-5xl gradient-title ">Add Transaction</h1>
      </div>
      <AddTransactionForm
        accounts={accounts}
        categories={defaultCategories}
        editMode={!!editId}
        initialData={initialData}
      />
    </div>
  );
}
