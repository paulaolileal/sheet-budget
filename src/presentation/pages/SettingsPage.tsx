import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "../components/PageHeader";
import { CategoryDialog } from "../components/CategoryDialog";
import { AppIcon } from "../components/AppIcon";
import { useCategories, useDeleteCategory } from "@/hooks/queries";
import { config } from "@/services/config";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/domain/types";

function CategoriesTab() {
  const { data: categories, isLoading } = useCategories();
  const deleteCategory = useDeleteCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingCategory(null);
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditingCategory(cat);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova categoria
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-md" />
          ))}
        </div>
      ) : !categories || categories.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nenhuma categoria</CardTitle>
            <CardDescription>Crie categorias para organizar seus lançamentos.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  Categoria
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.category_id} className="border-t">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <AppIcon iconId={cat.icon_id} size={15} className="text-muted-foreground shrink-0" />
                      <span className="font-medium">{cat.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(cat)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7",
                          deletingId === cat.category_id
                            ? "text-destructive hover:text-destructive"
                            : "text-muted-foreground",
                        )}
                        disabled={deleteCategory.isPending}
                        onClick={async () => {
                          if (deletingId !== cat.category_id) {
                            setDeletingId(cat.category_id);
                            return;
                          }
                          await deleteCategory.mutateAsync(cat.category_id);
                          setDeletingId(null);
                        }}
                        onBlur={() => {
                          if (deletingId === cat.category_id) setDeletingId(null);
                        }}
                        title={deletingId === cat.category_id ? "Confirmar exclusão" : "Excluir"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingCategory(null);
        }}
        category={editingCategory}
      />
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="px-4 py-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Configurações" description="Configurações do aplicativo." />

      <Tabs defaultValue="categories">
        <TabsList className="mb-6">
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="data">Fonte de dados</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fonte de dados</CardTitle>
              <CardDescription>Google Sheets como fonte de verdade.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">VITE_GOOGLE_CLIENT_ID</div>
                  <div className="font-mono">{config.googleClientId ? "configurado" : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">VITE_SPREADSHEET_ID</div>
                  <div className="font-mono">{config.spreadsheetId ? "configurado" : "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
