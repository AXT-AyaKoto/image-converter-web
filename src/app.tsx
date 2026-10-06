import type { TargetedDragEvent, TargetedEvent, TargetedInputEvent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
    canvasColor,
    convertFile,
    FORMATS,
    hexState,
    isFormat,
    isUnit,
    numberState,
    parseHexColor,
    readSettings,
    settingsErrorMessage,
    type Format,
    type Unit,
} from "./convert.ts";

type Item = { ok: true; name: string; href: string } | { ok: false; name: string; message: string };

function readyStatus(ready: number, total: number): string {
    if (total === 0) return "";
    const readyText = ready === 1 ? "1 image ready" : `${ready} images ready`;
    if (ready === total) return readyText;
    const failed = total - ready;
    const failedText = failed === 1 ? "1 failed" : `${failed} failed`;
    return `${readyText}, ${failedText}`;
}

export function App() {
    const [width, setWidth] = useState("1");
    const [widthUnit, setWidthUnit] = useState<Unit>("x");
    const [height, setHeight] = useState("1");
    const [heightUnit, setHeightUnit] = useState<Unit>("x");
    const [format, setFormat] = useState<Format>("png");
    const [background, setBackground] = useState("#00000000");
    const [files, setFiles] = useState<File[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [busy, setBusy] = useState(false);
    const [hot, setHot] = useState(false);
    const dragDepth = useRef(0);

    const error = settingsErrorMessage({ width, height, background });
    const color = parseHexColor(background);

    useEffect(() => {
        const prevent = (event: DragEvent) => {
            event.preventDefault();
        };
        const onWindowDrop = (event: DragEvent) => {
            event.preventDefault();
            dragDepth.current = 0;
            setHot(false);
        };
        window.addEventListener("dragover", prevent);
        window.addEventListener("drop", onWindowDrop);
        return () => {
            window.removeEventListener("dragover", prevent);
            window.removeEventListener("drop", onWindowDrop);
        };
    }, []);

    useEffect(() => {
        const settings = readSettings({
            width,
            widthUnit,
            height,
            heightUnit,
            format,
            background,
        });
        if (!settings) {
            setBusy(false);
            if (error) setItems([]);
            return;
        }
        if (files.length === 0) {
            setItems([]);
            setBusy(false);
            return;
        }

        let cancelled = false;
        setBusy(true);
        const timer = window.setTimeout(() => {
            void (async () => {
                const next: Item[] = [];
                for (const file of files) {
                    if (cancelled) return;
                    try {
                        const result = await convertFile(file, settings);
                        next.push({ ok: true, name: result.name, href: result.href });
                    } catch (caught) {
                        next.push({
                            ok: false,
                            name: file.name,
                            message: caught instanceof Error ? caught.message : "Could not convert this image.",
                        });
                    }
                }
                if (!cancelled) {
                    setItems(next);
                    setBusy(false);
                }
            })();
        }, 180);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [width, widthUnit, height, heightUnit, format, background, files, error]);

    const readyCount = items.filter((item) => item.ok).length;
    const status = busy ? "Converting" : readyStatus(readyCount, items.length);

    function takeFiles(list: FileList | null | undefined) {
        if (!list || list.length === 0) return;
        setFiles([...list]);
    }

    function onDragEnter(event: TargetedDragEvent<HTMLLabelElement>) {
        event.preventDefault();
        dragDepth.current += 1;
        setHot(true);
    }

    function onDragLeave(event: TargetedDragEvent<HTMLLabelElement>) {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setHot(false);
        }
    }

    function onDragOver(event: TargetedDragEvent<HTMLLabelElement>) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }

    function onDrop(event: TargetedDragEvent<HTMLLabelElement>) {
        event.preventDefault();
        dragDepth.current = 0;
        setHot(false);
        takeFiles(event.dataTransfer?.files);
    }

    function onPick(event: TargetedEvent<HTMLInputElement>) {
        takeFiles(event.currentTarget.files);
        event.currentTarget.value = "";
    }

    return (
        <main class="shell">
            <header class="masthead">
                <h1>Image Converter Web</h1>
                <p>Convert image formats. Runs in your browser. Nothing is collected.</p>
            </header>

            <div class="settings">
                <UnitField
                    id="width"
                    label="Width"
                    value={width}
                    unit={widthUnit}
                    invalid={numberState(width) === "invalid"}
                    onValue={setWidth}
                    onUnit={setWidthUnit}
                />
                <UnitField
                    id="height"
                    label="Height"
                    value={height}
                    unit={heightUnit}
                    invalid={numberState(height) === "invalid"}
                    onValue={setHeight}
                    onUnit={setHeightUnit}
                />
                <div class="field">
                    <label htmlFor="format">Format</label>
                    <select
                        id="format"
                        class="format"
                        value={format}
                        onChange={(event: TargetedEvent<HTMLSelectElement>) => {
                            const next = event.currentTarget.value;
                            if (isFormat(next)) setFormat(next);
                        }}
                    >
                        {FORMATS.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>
                <div class="field">
                    <label htmlFor="background">Background</label>
                    <input
                        id="background"
                        class="hex"
                        value={background}
                        spellcheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        inputMode="text"
                        placeholder="#00000000"
                        aria-invalid={hexState(background) === "invalid"}
                        onInput={(event: TargetedInputEvent<HTMLInputElement>) => {
                            setBackground(event.currentTarget.value);
                        }}
                    />
                    <span class="swatch" aria-hidden="true">
                        {color ? <span class="swatch-fill" style={{ background: canvasColor(color) }} /> : null}
                    </span>
                </div>
                {error ? (
                    <p class="banner" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>

            <div class="stage">
                <label
                    class={hot ? "dropzone is-hot" : "dropzone"}
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                >
                    <input class="file-input" type="file" accept="image/*" multiple onChange={onPick} />
                    <UploadIcon />
                    <span class="drop-hint">Drop or click to choose</span>
                </label>

                <div class="arrow" aria-hidden="true">
                    <ArrowIcon />
                </div>

                <section class={busy ? "output is-busy" : "output"} aria-label="Results" aria-busy={busy}>
                    <p class="sr-only" aria-live="polite">
                        {status}
                    </p>
                    {busy ? <p class="pending">Converting...</p> : null}
                    {items.length === 0 && !busy ? (
                        <p class="empty">Converted images show up here</p>
                    ) : (
                        items.map((item, index) => (
                            <article class="file" key={`${item.name}-${index}`}>
                                {item.ok ? <img class="thumb" alt="" src={item.href} draggable={false} /> : null}
                                <div class="file-text">
                                    <p class="name">{item.name}</p>
                                    {item.ok ? null : <p class="file-error">{item.message}</p>}
                                </div>
                                {item.ok ? (
                                    <a
                                        class="download"
                                        href={item.href}
                                        download={item.name}
                                        aria-label={`Download ${item.name}`}
                                    >
                                        <DownloadIcon />
                                    </a>
                                ) : null}
                            </article>
                        ))
                    )}
                </section>
            </div>

            <footer class="site-footer">
                <p>
                    copyright (c) 2026- Ayasaka-Koto, released under{" "}
                    <a href="https://opensource.org/license/mit" target="_blank" rel="noreferrer">
                        the MIT License.
                    </a>
                </p>
                <p>
                    GitHub Repo:{" "}
                    <a href="https://github.com/AXT-AyaKoto/image-converter-web" target="_blank" rel="noreferrer">
                        <code>AXT-AyaKoto/image-converter-web</code>
                    </a>{" "}
                    | Ayasaka-Koto:{" "}
                    <a href="https://axtech.dev" target="_blank" rel="noreferrer">
                        <code>axtech.dev</code>
                    </a>
                </p>
            </footer>
        </main>
    );
}

function UnitField(props: {
    id: string;
    label: string;
    value: string;
    unit: Unit;
    invalid: boolean;
    onValue: (value: string) => void;
    onUnit: (unit: Unit) => void;
}) {
    const unitId = `${props.id}-unit`;
    return (
        <div class="field">
            <label htmlFor={props.id}>{props.label}</label>
            <input
                id={props.id}
                class="number"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={props.value}
                aria-invalid={props.invalid}
                onInput={(event: TargetedInputEvent<HTMLInputElement>) => {
                    props.onValue(event.currentTarget.value);
                }}
            />
            <select
                id={unitId}
                class="unit"
                aria-label={`${props.label} unit`}
                title="px: pixels. x: scale of the original size."
                value={props.unit}
                onChange={(event: TargetedEvent<HTMLSelectElement>) => {
                    const next = event.currentTarget.value;
                    if (isUnit(next)) props.onUnit(next);
                }}
            >
                <option value="px">px</option>
                <option value="x">x</option>
            </select>
        </div>
    );
}

function UploadIcon() {
    return (
        <svg class="upload-icon" viewBox="0 0 64 64" width="84" height="84" aria-hidden="true">
            <path
                d="M32 40V14M21 25l11-11 11 11"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                d="M14 36v16h36V36"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    );
}

function DownloadIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
                d="M12 4v9M8 9l4 4 4-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                d="M5 16.5V20h14v-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    );
}

function ArrowIcon() {
    return (
        <svg viewBox="0 0 48 24" width="48" height="24">
            <path
                d="M2 12h38M32 4l8 8-8 8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    );
}
