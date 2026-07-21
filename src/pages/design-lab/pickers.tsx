import * as React from "react";

import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-field";
import { DateTimeField } from "@/components/ui/date-time-field";
import { DateTimePicker } from "@/components/ui/datetime-picker";

/**
 * Scratch gallery for the date/time controls. Unauthenticated so the pickers
 * can be exercised without a magic-link sign-in.
 */
export default function PickersLab() {
    const [a, setA] = React.useState<Date | undefined>();
    const [b, setB] = React.useState<Date | undefined>(new Date(2026, 6, 20, 14, 30));
    const [c, setC] = React.useState<Date | undefined>();
    const [d, setD] = React.useState<Date | undefined>(new Date(2026, 6, 20, 9, 0));
    const [e, setE] = React.useState<Date | undefined>();

    const show = (v: Date | undefined) => (v ? v.toString() : "undefined");

    return (
        <div className="mx-auto max-w-2xl space-y-10 p-10">
            <h1 className="text-2xl font-semibold">Picker gallery</h1>

            <section className="space-y-2">
                <Label>DateTimeField — empty (split, the form layout)</Label>
                <DateTimeField date={a} setDate={setA} clearable />
                <p className="font-mono text-xs text-muted-foreground">{show(a)}</p>
            </section>

            <section className="space-y-2">
                <Label>DateTimeField — prefilled</Label>
                <DateTimeField date={b} setDate={setB} clearable />
                <p className="font-mono text-xs text-muted-foreground">{show(b)}</p>
            </section>

            <section className="space-y-2">
                <Label>DatePicker alone</Label>
                <DatePicker date={c} setDate={setC} clearable />
                <p className="font-mono text-xs text-muted-foreground">{show(c)}</p>
            </section>

            <section className="space-y-2">
                <Label>TimeField alone</Label>
                <div className="w-[200px]">
                    <TimeField date={d} setDate={setD} clearable />
                </div>
                <p className="font-mono text-xs text-muted-foreground">{show(d)}</p>
            </section>

            <section className="space-y-2">
                <Label>DateTimePicker (combined, kept in the library)</Label>
                <DateTimePicker date={e} setDate={setE} clearable />
                <p className="font-mono text-xs text-muted-foreground">{show(e)}</p>
            </section>

            <section className="space-y-2">
                <Label>Long value / truncation check</Label>
                <DatePicker
                    date={new Date(2026, 8, 30)}
                    setDate={() => {}}
                    clearable
                    className="w-[240px]"
                />
            </section>
        </div>
    );
}
