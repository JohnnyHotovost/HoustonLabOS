import { forwardRef, useEffect, useState } from "react";
import { Input } from "../ui/input";

/**
 * Numeric/money input that doesn't fight you when the value is 0.
 * - Internally a string (so deleting "0" leaves the field empty).
 * - On focus, if displayed value is "0", select-all so a single keystroke replaces it.
 * - On blur, an empty/invalid value commits as 0 (parent receives a real number).
 *
 * Keeps the <Input> styling intact — used as a drop-in replacement.
 */
const MoneyInput = forwardRef(function MoneyInput(
    { value, onChange, allowNegative = false, ...rest },
    ref,
) {
    const [text, setText] = useState(() => (value === 0 || value == null ? "0" : String(value)));

    // Keep local state in sync when the parent replaces the value (load from server, reset, etc.).
    useEffect(() => {
        const current = parseFloat(text);
        if (Number.isFinite(current) && current === Number(value)) return;
        if (text === "" && (value === 0 || value == null)) return;
        setText(value === 0 || value == null ? "0" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const commit = (raw) => {
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
            onChange?.(0);
            return;
        }
        const n = parseFloat(raw);
        onChange?.(Number.isFinite(n) ? n : 0);
    };

    return (
        <Input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={text}
            onFocus={(e) => {
                if (text === "0") e.target.select();
                rest.onFocus?.(e);
            }}
            onChange={(e) => {
                let v = e.target.value;
                // permit only digits, one decimal, optional leading minus
                const re = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
                if (v === "" || re.test(v)) {
                    setText(v);
                    if (v === "" || v === "-" || v === "." || v === "-.") {
                        // wait for blur to commit 0
                        return;
                    }
                    const n = parseFloat(v);
                    if (Number.isFinite(n)) onChange?.(n);
                }
            }}
            onBlur={(e) => {
                if (text === "" || text === "-" || text === "." || text === "-.") {
                    setText("0");
                    onChange?.(0);
                }
                rest.onBlur?.(e);
            }}
            {...rest}
        />
    );
});

export default MoneyInput;
