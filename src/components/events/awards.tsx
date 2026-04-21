import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export type AwardRecipient = {
    userId: string;
    firstName?: string;
    lastName?: string;
    initials?: string;
    displayName: string;
    email?: string;
};

export type EventAward = {
    id: string;
    type: "main_place" | "special";
    place?: 1 | 2 | 3 | null;
    title: string;
    prizeDescription?: string;
    recipientIds?: string[];
    recipientProfiles?: AwardRecipient[];
};

export const toMainPlaceNumber = (value: unknown): 1 | 2 | 3 | null => {
    if (value === "1" || value === 1) return 1;
    if (value === "2" || value === 2) return 2;
    if (value === "3" || value === 3) return 3;
    return null;
};

export const getMainPlaceTitle = (place: 1 | 2 | 3): string => {
    if (place === 1) return "1st Place";
    if (place === 2) return "2nd Place";
    return "3rd Place";
};

export const getAwardPlaceLabel = (place?: 1 | 2 | 3 | null): string => {
    if (place === 1) return "1st Place";
    if (place === 2) return "2nd Place";
    if (place === 3) return "3rd Place";
    return "Award";
};

export const getAwardTypeLabel = (award: EventAward): string => {
    if (award.type === "main_place") {
        return getAwardPlaceLabel(award.place ?? null);
    }
    return "Special Award";
};

export const getAwardWinners = (award: EventAward): AwardRecipient[] => award.recipientProfiles || [];

export function EventAwardsDisplay({ awards, loading }: { awards: EventAward[]; loading: boolean }) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

    if (loading) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading awards...
            </div>
        );
    }

    if (!awards || awards.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                No awards have been added for this event yet.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {awards.map((award) => {
                const winners = getAwardWinners(award);
                const hasLongDescription = (award.prizeDescription || "").length > 180;
                const isExpanded = expanded[award.id] || false;
                const description = award.prizeDescription || "No prize description provided.";

                return (
                    <div key={award.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft-xl">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="rounded-full">
                                        {getAwardTypeLabel(award)}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-full">
                                        {award.type === "main_place"
                                            ? `Place ${award.place ?? "N/A"}`
                                            : "Special Recognition"}
                                    </Badge>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">{award.title}</h3>
                            </div>

                            {winners.length > 0 && (
                                <Badge variant="success" className="rounded-full">
                                    {winners.length} {winners.length === 1 ? "winner" : "winners"}
                                </Badge>
                            )}
                        </div>

                        <div className="mt-4 space-y-3">
                            <div>
                                <p className="text-sm font-medium text-slate-900">Prize description</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                    {isExpanded || !hasLongDescription
                                        ? description
                                        : `${description.slice(0, 180).trimEnd()}...`}
                                </p>
                                {hasLongDescription && (
                                    <button
                                        type="button"
                                        onClick={() => toggle(award.id)}
                                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                                    >
                                        {isExpanded ? "Show less" : "Show more"}
                                    </button>
                                )}
                            </div>

                            {winners.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Winners</p>
                                    <div className="mt-2 flex flex-wrap gap-3">
                                        {winners.map((winner) => (
                                            <div key={winner.userId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarFallback className="bg-slate-200 text-slate-700 text-xs font-semibold">
                                                        {winner.initials || winner.displayName.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">{winner.displayName}</p>
                                                    {winner.email && <p className="text-xs text-slate-500">{winner.email}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

type EditorProps = {
    form: any;
    awardFields: any[];
    appendAward: (a: any) => void;
    removeAward: (i: number) => void;
    replaceAwards: (a: any[]) => void;
    watchAwards: any[];
    registrations: any[];
    loadingRegistrations: boolean;
    removedAwardIds: string[];
    setRemovedAwardIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function EventAwardsEditor({
    form,
    awardFields,
    appendAward,
    removeAward,
    replaceAwards,
    watchAwards,
    registrations,
    loadingRegistrations,
    removedAwardIds,
    setRemovedAwardIds,
}: EditorProps) {
    return (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <Trophy className="h-5 w-5 text-slate-700" />
                        Awards
                    </h3>
                    <p className="text-sm text-slate-600">Add optional awards for this event. Main place awards require a place. Assign winners below.</p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        const takenMainPlaces = new Set(
                            (watchAwards || [])
                                .map((a: any) => (a?.type === "main_place" ? toMainPlaceNumber(a.place) : null))
                                .filter((p: any) => p !== null)
                        );
                        const nextAvailableMainPlace = ([1, 2, 3] as const).find((p) => !takenMainPlaces.has(p)) ?? null;

                        if (nextAvailableMainPlace) {
                            appendAward({
                                type: "main_place",
                                place: nextAvailableMainPlace,
                                title: getMainPlaceTitle(nextAvailableMainPlace),
                                prizeDescription: "",
                                recipientIds: [],
                            });
                            return;
                        }

                        appendAward({
                            type: "special",
                            place: null,
                            title: "",
                            prizeDescription: "",
                            recipientIds: [],
                        });
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Award
                </Button>
            </div>

            {awardFields.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">No awards added yet.</div>
            ) : (
                <div className="space-y-4">
                    {awardFields.map((award: any, index: number) => {
                        const typeFieldName = `awards.${index}.type` as const;
                        const placeFieldName = `awards.${index}.place` as const;
                        const titleFieldName = `awards.${index}.title` as const;
                        const prizeFieldName = `awards.${index}.prizeDescription` as const;
                        const selectedType = form.watch(typeFieldName);
                        const selectedPlace = toMainPlaceNumber(form.getValues(placeFieldName));
                        const takenMainPlacesByOthers = new Set(
                            (watchAwards || [])
                                .map((awardValue: any, awardIndex: number) => {
                                    if (awardIndex === index) return null;
                                    if (awardValue?.type !== "main_place") return null;
                                    return toMainPlaceNumber(awardValue.place);
                                })
                                .filter((place: any): place is 1 | 2 | 3 => place !== null)
                        );

                        return (
                            <div key={award.id || index} className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-800">Award {index + 1}</p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="text-red-600"
                                        onClick={() => {
                                            const values = form.getValues(`awards.${index}` as any) as any;
                                            if (values?.id) setRemovedAwardIds((s) => [...s, values.id]);
                                            removeAward(index);
                                        }}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remove
                                    </Button>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Award Type *</label>
                                        <select
                                            value={form.getValues(typeFieldName)}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                form.setValue(typeFieldName, value, { shouldValidate: true, shouldDirty: true });
                                                if (value === "special") {
                                                    form.setValue(placeFieldName, null, { shouldValidate: true, shouldDirty: true });
                                                } else if (form.getValues(placeFieldName) === null) {
                                                    form.setValue(placeFieldName, 1, { shouldValidate: true, shouldDirty: true });
                                                    form.setValue(titleFieldName, getMainPlaceTitle(1), { shouldValidate: true, shouldDirty: true });
                                                }
                                            }}
                                            className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-xs"
                                        >
                                            <option value="main_place">Main Place</option>
                                            <option value="special">Special</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Place</label>
                                        <select
                                            value={form.getValues(placeFieldName) === null ? "" : String(form.getValues(placeFieldName))}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                form.setValue(placeFieldName, v === "" ? null : Number(v), { shouldValidate: true, shouldDirty: true });
                                                const parsedPlace = toMainPlaceNumber(v);
                                                if (form.getValues(typeFieldName) === "main_place" && parsedPlace) {
                                                    form.setValue(titleFieldName, getMainPlaceTitle(parsedPlace), { shouldValidate: true, shouldDirty: true });
                                                }
                                            }}
                                            disabled={form.getValues(typeFieldName) === "special"}
                                            className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-xs"
                                        >
                                            <option value="">Select place</option>
                                            <option value="1" disabled={takenMainPlacesByOthers.has(1) && selectedPlace !== 1}>1st Place</option>
                                            <option value="2" disabled={takenMainPlacesByOthers.has(2) && selectedPlace !== 2}>2nd Place</option>
                                            <option value="3" disabled={takenMainPlacesByOthers.has(3) && selectedPlace !== 3}>3rd Place</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Award Title *</label>
                                    <input
                                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-xs"
                                        value={form.getValues(titleFieldName)}
                                        onChange={(e) => form.setValue(titleFieldName, e.target.value, { shouldDirty: true })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Prize Description</label>
                                    <input
                                        className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-xs"
                                        value={form.getValues(prizeFieldName)}
                                        onChange={(e) => form.setValue(prizeFieldName, e.target.value, { shouldDirty: true })}
                                    />
                                    <p className="text-sm text-slate-500">Optional short description of the prize</p>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-slate-800">Winners</p>
                                    {loadingRegistrations ? (
                                        <p className="text-sm text-slate-500">Loading attendees…</p>
                                    ) : registrations.length === 0 ? (
                                        <p className="text-sm text-slate-500">No attendees to assign as winners.</p>
                                    ) : (
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-auto">
                                            {registrations.map((reg) => {
                                                const checked = (form.getValues(`awards.${index}.recipientIds`) || []).includes(reg.userId);
                                                return (
                                                    <label key={reg.userId} className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(e) => {
                                                                const cur: string[] = form.getValues(`awards.${index}.recipientIds`) || [];
                                                                if (e.target.checked) {
                                                                    form.setValue(`awards.${index}.recipientIds`, [...cur, reg.userId], { shouldDirty: true });
                                                                } else {
                                                                    form.setValue(`awards.${index}.recipientIds`, cur.filter((id) => id !== reg.userId), { shouldDirty: true });
                                                                }
                                                            }}
                                                        />
                                                        <div className="text-sm">
                                                            <div className="font-medium">{reg.firstName || ""} {reg.lastName || ""}</div>
                                                            <div className="text-xs text-slate-500">{reg.email}</div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {form.formState.errors.awards?.message && (
                <p className="text-sm font-medium text-red-600">{String(form.formState.errors.awards?.message)}</p>
            )}
        </div>
    );
}

export default EventAwardsDisplay;
