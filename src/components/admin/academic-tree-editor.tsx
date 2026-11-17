"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { AcademicNodeType } from "@prisma/client";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  FileUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createNodeAction,
  deleteNodeAction,
  importCsvAction,
  moveNodeAction,
  updateNodeAction,
} from "@/app/admin/actions";
import { emptyFormState } from "@/lib/action-state";
import { parseAcademicCsv, type CsvRow } from "@/lib/domain/academic-csv";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlays";
import { Badge } from "@/components/admin/status-badge";
import { cn } from "@/lib/utils";
import type { LayerLabels } from "@/lib/services/universities";

export interface EditorNode {
  id: string;
  parentId: string | null;
  type: AcademicNodeType;
  name: string;
  isActive: boolean;
  levels: number[];
}

const LEVEL_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

function TreeRows({
  nodes,
  parentId,
  depth,
  labels,
  onEdit,
  onDelete,
}: {
  nodes: EditorNode[];
  parentId: string | null;
  depth: number;
  labels: LayerLabels;
  onEdit: (node: EditorNode) => void;
  onDelete: (node: EditorNode) => void;
}) {
  const children = nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (children.length === 0) return null;

  return (
    <ul className={cn(depth > 0 && "border-l border-border pl-3")} role={depth === 0 ? "tree" : "group"}>
      {children.map((node) => {
        const typeLabel =
          node.type === "COLLEGE" ? labels.college : node.type === "FACULTY" ? labels.faculty : labels.department;
        return (
          <li key={node.id} role="treeitem" aria-selected={false} aria-expanded={node.type !== "DEPARTMENT" ? true : undefined} className="py-1">
            <div className={cn("group flex items-center gap-2 rounded-button px-2 py-1.5 hover:bg-surface-2", !node.isActive && "opacity-60")}>
              <ChevronRight aria-hidden="true" className={cn("size-3.5 text-fg-subtle", node.type === "DEPARTMENT" && "invisible")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold text-fg">
                  {node.name}
                  {!node.isActive ? <span className="ml-2 text-[0.6875rem] font-normal text-fg-subtle">(inactive)</span> : null}
                </span>
                <span className="text-[0.6875rem] text-fg-subtle">
                  {typeLabel}
                  {node.type === "DEPARTMENT" && node.levels.length > 0 ? ` · ${node.levels.join(", ")} levels` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <form action={moveNodeAction}>
                  <input type="hidden" name="nodeId" value={node.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" className="flex size-7 items-center justify-center rounded hover:bg-surface-2" aria-label={`Move ${node.name} up`}>
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                  </button>
                </form>
                <form action={moveNodeAction}>
                  <input type="hidden" name="nodeId" value={node.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" className="flex size-7 items-center justify-center rounded hover:bg-surface-2" aria-label={`Move ${node.name} down`}>
                    <ArrowDown aria-hidden="true" className="size-3.5" />
                  </button>
                </form>
                <button type="button" onClick={() => onEdit(node)} className="flex size-7 items-center justify-center rounded hover:bg-surface-2" aria-label={`Edit ${node.name}`}>
                  <Pencil aria-hidden="true" className="size-3.5" />
                </button>
                <button type="button" onClick={() => onDelete(node)} className="flex size-7 items-center justify-center rounded text-danger hover:bg-danger-soft" aria-label={`Delete ${node.name}`}>
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </div>
            <TreeRows nodes={nodes} parentId={node.id} depth={depth + 1} labels={labels} onEdit={onEdit} onDelete={onDelete} />
          </li>
        );
      })}
    </ul>
  );
}

export function AcademicTreeEditor({ nodes, labels }: { nodes: EditorNode[]; labels: LayerLabels }) {
  const [addState, addAction, addPending] = useActionState(createNodeAction, emptyFormState);
  const [editState, editAction, editPending] = useActionState(updateNodeAction, emptyFormState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteNodeAction, emptyFormState);
  const [csvState, csvAction, csvPending] = useActionState(importCsvAction, emptyFormState);

  const [type, setType] = useState<AcademicNodeType>("FACULTY");
  const [editing, setEditing] = useState<EditorNode | null>(null);
  const [deleting, setDeleting] = useState<EditorNode | null>(null);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof parseAcademicCsv> | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const parents = useMemo(
    () =>
      nodes.filter((node) =>
        type === "FACULTY" ? node.type === "COLLEGE" : type === "DEPARTMENT" ? node.type === "FACULTY" : false,
      ),
    [nodes, type],
  );

  const existingForCsv = useMemo(
    () => nodes.map((node) => ({ name: node.name, type: node.type, parentId: node.parentId })),
    [nodes],
  );

  const runPreview = (text: string) => {
    setCsvText(text);
    setPreview(text.trim() ? parseAcademicCsv(text, existingForCsv) : null);
  };

  const creatable = preview?.rows.filter((row) => row.action === "create") ?? [];

  useEffect(() => {
    if (editState.ok) setEditing(null);
  }, [editState.ok]);

  useEffect(() => {
    if (deleteState.ok) setDeleting(null);
  }, [deleteState.ok]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-card border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-h3 text-fg">Structure</h2>
            <p className="text-small text-fg-muted">
              {labels.college} → {labels.faculty} → {labels.department}. Order controls the signup picker.
            </p>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-2">
            {nodes.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-small font-semibold text-fg">The tree is empty.</p>
                <p className="mt-1 text-small text-fg-muted">Add a faculty first, then its departments.</p>
              </div>
            ) : (
              <TreeRows nodes={nodes} parentId={null} depth={0} labels={labels} onEdit={setEditing} onDelete={setDeleting} />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-h3 text-fg">Add a node</h2>
            <form action={addAction} className="mt-3 space-y-3">
              <div>
                <label htmlFor="node-type" className="mb-1 block text-small font-semibold text-fg">Type</label>
                <select
                  id="node-type"
                  name="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as AcademicNodeType)}
                  className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small"
                >
                  <option value="COLLEGE">{labels.college}</option>
                  <option value="FACULTY">{labels.faculty}</option>
                  <option value="DEPARTMENT">{labels.department}</option>
                </select>
              </div>
              <div>
                <label htmlFor="node-name" className="mb-1 block text-small font-semibold text-fg">Name</label>
                <input
                  id="node-name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder={type === "DEPARTMENT" ? "Computer Science" : type === "FACULTY" ? "Faculty of Science" : "College of Health Sciences"}
                  className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small"
                />
              </div>
              {type !== "COLLEGE" ? (
                <div>
                  <label htmlFor="node-parent" className="mb-1 block text-small font-semibold text-fg">
                    Parent {type === "DEPARTMENT" ? labels.faculty : labels.college}
                  </label>
                  <select id="node-parent" name="parentId" className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small">
                    <option value="">{type === "DEPARTMENT" ? "Choose a faculty…" : "None (top level)"}</option>
                    {parents.map((parent) => (
                      <option key={parent.id} value={parent.id}>{parent.name}</option>
                    ))}
                  </select>
                  {type === "DEPARTMENT" && parents.length === 0 ? (
                    <p className="mt-1 text-[0.75rem] text-warning">Create a {labels.faculty.toLowerCase()} first.</p>
                  ) : null}
                </div>
              ) : null}
              {type === "DEPARTMENT" ? (
                <fieldset>
                  <legend className="mb-1.5 text-small font-semibold text-fg">Levels offered</legend>
                  <div className="flex flex-wrap gap-2">
                    {LEVEL_OPTIONS.map((level) => (
                      <label key={level} className="inline-flex items-center gap-1.5 rounded-chip border border-border px-2.5 py-1 text-[0.75rem] font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-soft-fg">
                        <input type="checkbox" name="levels" value={level} defaultChecked={[100, 200, 300, 400].includes(level)} className="size-3 accent-[var(--accent)]" />
                        {level}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {addState.error ? (
                <p role="alert" className="flex items-start gap-1.5 text-small text-danger">
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {addState.error}
                </p>
              ) : null}
              {addState.ok ? (
                <p role="status" className="flex items-center gap-1.5 text-small font-semibold text-success">
                  <Check aria-hidden="true" className="size-4" /> {addState.message}
                </p>
              ) : null}
              <Button type="submit" loading={addPending} fullWidth>
                <Plus aria-hidden="true" className="size-4" /> Add to tree
              </Button>
            </form>
          </div>

          <div className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-h3 text-fg">Import CSV</h2>
            <p className="mt-1 text-small text-fg-muted">
              Columns: college, faculty, department, levels (semicolon separated). Header optional.
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-button border border-dashed border-border-strong px-3 py-2.5 text-small font-semibold text-fg-muted hover:bg-surface-2">
              <FileUp aria-hidden="true" className="size-4" />
              {fileName ?? "Choose a CSV file"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 512 * 1024) {
                    setPreview({ rows: [], valid: false, error: "That file is larger than 512 KB." });
                    return;
                  }
                  setFileName(file.name);
                  runPreview(await file.text());
                }}
              />
            </label>
            <label htmlFor="csv-text" className="mt-3 block text-small font-semibold text-fg">Or paste rows</label>
            <textarea
              id="csv-text"
              value={csvText}
              onChange={(event) => { setFileName(null); runPreview(event.target.value); }}
              rows={4}
              placeholder={"College of Science,Faculty of Science,Computer Science,100;200;300;400\nCollege of Arts,Faculty of Arts,History,100;200;300"}
              className="mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 font-mono text-[0.75rem] text-fg placeholder:text-fg-subtle"
            />

            {preview ? (
              <div className="mt-3">
                {preview.error ? <p role="alert" className="text-small text-danger">{preview.error}</p> : null}
                {preview.rows.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[0.75rem] font-semibold text-fg">
                        Preview · {preview.rows.length} rows
                      </p>
                      <p className="text-[0.75rem] text-fg-subtle">{creatable.length} to create</p>
                    </div>
                    <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto text-[0.75rem]">
                      {preview.rows.map((row) => (
                        <li key={`${row.line}-${row.department}`} className="flex items-center justify-between gap-2 rounded bg-surface-2 px-2 py-1">
                          <span className="min-w-0 truncate text-fg-muted">
                            {row.department} <span className="text-fg-subtle">· {row.faculty || "General"}</span>
                          </span>
                          <Badge tone={row.action === "create" ? "accent" : row.action === "exists" ? "neutral" : "danger"}>
                            {row.action === "create" ? "new" : row.action === "exists" ? "exists" : row.message}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {preview.valid && creatable.length > 0 ? (
                  <form action={csvAction} className="mt-2">
                    <input type="hidden" name="rows" value={JSON.stringify(creatable)} />
                    <Button type="submit" loading={csvPending} fullWidth variant="secondary">
                      Import {creatable.length} {creatable.length === 1 ? "row" : "rows"}
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
            {csvState.error ? <p role="alert" className="mt-2 text-small text-danger">{csvState.error}</p> : null}
            {csvState.ok ? (
              <p role="status" className="mt-2 flex items-center gap-1.5 text-small font-semibold text-success">
                <Check aria-hidden="true" className="size-4" /> {csvState.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit node"
        description="Renaming does not move students; their department id stays the same."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button form="edit-node-form" type="submit" loading={editPending}>Save</Button>
          </>
        }
      >
        {editing ? (
          <form id="edit-node-form" action={editAction} className="space-y-3">
            <input type="hidden" name="nodeId" value={editing.id} />
            <div>
              <label htmlFor="edit-name" className="mb-1 block text-small font-semibold text-fg">Name</label>
              <input id="edit-name" name="name" defaultValue={editing.name} required maxLength={80} className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
            </div>
            {editing.type === "DEPARTMENT" ? (
              <fieldset>
                <legend className="mb-1.5 text-small font-semibold text-fg">Levels</legend>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map((level) => (
                    <label key={level} className="inline-flex items-center gap-1.5 rounded-chip border border-border px-2.5 py-1 text-[0.75rem] font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                      <input type="checkbox" name="levels" value={level} defaultChecked={editing.levels.includes(level)} className="size-3 accent-[var(--accent)]" />
                      {level}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <label className="flex items-center justify-between gap-3 rounded-input border border-border px-3 py-2 text-small font-semibold text-fg">
              Active (offered at signup)
              <input type="checkbox" name="isActive" value="true" defaultChecked={editing.isActive} className="size-4 accent-[var(--accent)]" />
            </label>
            {editState.error ? <p role="alert" className="text-small text-danger">{editState.error}</p> : null}
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "node"}?`}
        description="Only empty nodes can be deleted. If students are assigned, deactivate it instead."
        destructive
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <form action={deleteAction}>
              <input type="hidden" name="nodeId" value={deleting?.id ?? ""} />
              <Button type="submit" variant="destructive" loading={deletePending}>Delete node</Button>
            </form>
          </>
        }
      >
        {deleteState.error ? <p role="alert" className="text-small text-danger">{deleteState.error}</p> : null}
      </Dialog>
    </div>
  );
}
