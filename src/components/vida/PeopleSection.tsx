import { useState } from "react";
import { PersonalPerson, useCreatePerson, useDeletePerson } from "@/hooks/usePersonalPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";

export function PeopleSection({ people }: { people: PersonalPerson[] }) {
  const createPerson = useCreatePerson();
  const deletePerson = useDeletePerson();
  const [draft, setDraft] = useState({ name: "", role: "" });

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h3 className="font-semibold mb-3">Pessoas-chave</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {people.map((p) => (
          <div key={p.id} className="border border-border rounded p-3 flex items-start justify-between">
            <div>
              <div className="font-medium text-sm">{p.name}</div>
              {p.role && (
                <Badge variant="outline" className="text-xs mt-1">
                  {p.role}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => deletePerson.mutate(p.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Nome"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          placeholder="Papel (ex: cônjuge)"
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value })}
        />
        <Button
          onClick={async () => {
            if (!draft.name.trim()) return;
            await createPerson.mutateAsync({ name: draft.name.trim(), role: draft.role || null, importance: 3 });
            setDraft({ name: "", role: "" });
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
