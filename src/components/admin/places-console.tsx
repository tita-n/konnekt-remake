"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiDelete, apiPatch, apiPost } from "@/lib/posts/client";
import type { CampusPlaceView } from "@/lib/services/event-admin";

export function PlacesConsole({ initialPlaces }: { initialPlaces: CampusPlaceView[] }) {
  const [places, setPlaces] = useState(initialPlaces);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost<{ id: string }>("/api/admin/campus-places", {
        name,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      });
      setPlaces((current) => [
        ...current,
        { id: created.id, name, active: true, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, eventCount: 0 },
      ]);
      setName("");
      setLatitude("");
      setLongitude("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that place.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (place: CampusPlaceView) => {
    setError(null);
    try {
      await apiPatch(`/api/admin/campus-places/${place.id}`, { active: !place.active });
      setPlaces((current) => current.map((entry) => (entry.id === place.id ? { ...entry, active: !entry.active } : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that place.");
    }
  };

  const remove = async (place: CampusPlaceView) => {
    setError(null);
    try {
      await apiDelete(`/api/admin/campus-places/${place.id}`);
      setPlaces((current) => current.filter((entry) => entry.id !== place.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that place.");
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Campus places</h1>
        <p className="mt-1 text-small text-fg-muted">
          Curated venues organisers can attach to events. Coordinates power the map link.
        </p>
      </header>

      <form onSubmit={add} className="space-y-3 rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Add a place</h2>
        <div>
          <label htmlFor="place-name" className="text-small font-semibold text-fg">
            Name
          </label>
          <input
            id="place-name"
            value={name}
            onChange={(change) => setName(change.target.value)}
            required
            maxLength={80}
            placeholder="e.g. Main Auditorium"
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-bg px-3 text-small text-fg"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="place-lat" className="text-small font-semibold text-fg">
              Latitude <span className="font-normal text-fg-muted">(optional)</span>
            </label>
            <input
              id="place-lat"
              type="number"
              step="any"
              value={latitude}
              onChange={(change) => setLatitude(change.target.value)}
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-bg px-3 text-small text-fg"
            />
          </div>
          <div>
            <label htmlFor="place-lng" className="text-small font-semibold text-fg">
              Longitude <span className="font-normal text-fg-muted">(optional)</span>
            </label>
            <input
              id="place-lng"
              type="number"
              step="any"
              value={longitude}
              onChange={(change) => setLongitude(change.target.value)}
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-bg px-3 text-small text-fg"
            />
          </div>
        </div>
        <Button type="submit" loading={busy} disabled={name.trim().length < 2}>
          <Plus aria-hidden="true" className="size-4" />
          Add place
        </Button>
        <FormMessage error={error} message={null} />
      </form>

      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {places.length === 0 ? (
          <li className="p-4 text-small text-fg-muted">No places yet.</li>
        ) : (
          places.map((place) => (
            <li key={place.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="flex size-11 items-center justify-center rounded-[11px] bg-accent-soft text-accent-ink">
                <MapPin aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-small font-semibold text-fg">{place.name}</p>
                <p className="text-tiny text-fg-muted">
                  {place.eventCount} event{place.eventCount === 1 ? "" : "s"}
                  {place.latitude && place.longitude ? " · has coordinates" : ""}
                  {place.active ? "" : " · hidden"}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void toggle(place)}>
                {place.active ? "Hide" : "Show"}
              </Button>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={() => void remove(place)}>
                Delete
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
