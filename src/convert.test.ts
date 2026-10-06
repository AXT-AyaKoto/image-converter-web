import { describe, expect, it } from "vite-plus/test";
import {
    canvasColor,
    hexState,
    numberState,
    outputName,
    parseHexColor,
    planSize,
    readSettings,
    resolvePixels,
    settingsErrorMessage,
} from "./convert.ts";

describe("numberState", () => {
    it("accepts positive integers and decimals", () => {
        expect(numberState("1")).toBe("ok");
        expect(numberState(" 1.5 ")).toBe("ok");
        expect(numberState("1920")).toBe("ok");
    });

    it("treats an unfinished decimal as partial", () => {
        expect(numberState("")).toBe("partial");
        expect(numberState("1.")).toBe("partial");
        expect(numberState(".")).toBe("partial");
    });

    it("rejects zero, negatives, and junk", () => {
        expect(numberState("0")).toBe("invalid");
        expect(numberState("-2")).toBe("invalid");
        expect(numberState("1e2")).toBe("invalid");
        expect(numberState("px")).toBe("invalid");
    });
});

describe("hexState and parseHexColor", () => {
    it("parses 3, 4, 6, and 8 digit hex with or without a hash", () => {
        expect(parseHexColor("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 255 });
        expect(parseHexColor("#abc8")).toEqual({ r: 170, g: 187, b: 204, a: 136 });
        expect(parseHexColor("ff00aa")).toEqual({ r: 255, g: 0, b: 170, a: 255 });
        expect(parseHexColor("#00000000")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it("keeps incomplete hex partial and rejects the rest", () => {
        expect(hexState("#12")).toBe("partial");
        expect(hexState("#")).toBe("partial");
        expect(hexState("#12345")).toBe("partial");
        expect(hexState("#1234567")).toBe("partial");
        expect(hexState("#gg0000")).toBe("invalid");
        expect(hexState("#123456789")).toBe("invalid");
        expect(parseHexColor("#12")).toBeNull();
    });

    it("turns alpha into a canvas color", () => {
        expect(canvasColor({ r: 0, g: 0, b: 0, a: 0 })).toBe("rgb(0 0 0 / 0)");
        expect(canvasColor({ r: 255, g: 255, b: 255, a: 255 })).toBe("rgb(255 255 255 / 1)");
    });
});

describe("settings", () => {
    it("describes which field is wrong", () => {
        expect(settingsErrorMessage({ width: "0", height: "1", background: "#00000000" })).toBe(
            "Enter a positive number for width and height.",
        );
        expect(settingsErrorMessage({ width: "1", height: "1", background: "red" })).toBe(
            "Background must be a 3, 4, 6, or 8 digit hex color.",
        );
        expect(settingsErrorMessage({ width: "1.", height: "1", background: "#fff" })).toBeNull();
    });

    it("reads a complete setting", () => {
        expect(
            readSettings({
                width: "1920",
                widthUnit: "px",
                height: "2",
                heightUnit: "x",
                format: "png",
                background: "#00000000",
            }),
        ).toMatchObject({ width: 1920, widthUnit: "px", height: 2, heightUnit: "x", format: "png" });
    });
});

describe("planSize", () => {
    it("resolves px and multipliers independently", () => {
        expect(planSize(100, 50, { width: 1920, widthUnit: "px", height: 2, heightUnit: "x" })).toEqual({
            width: 1920,
            height: 100,
        });
        expect(resolvePixels(1.26, "x", 10)).toBe(13);
    });

    it("rejects sizes that round below 1px or exceed the canvas cap", () => {
        expect(planSize(10, 10, { width: 0.01, widthUnit: "x", height: 1, heightUnit: "x" })).toEqual({
            error: "Width and height must be at least 1px.",
        });
        expect(planSize(4000, 4000, { width: 4, widthUnit: "x", height: 4, heightUnit: "x" })).toMatchObject({
            error: expect.stringContaining("too large"),
        });
    });
});

describe("outputName", () => {
    it("replaces the extension and keeps the stem", () => {
        expect(outputName("hoge.png", "png")).toBe("hoge.png");
        expect(outputName("hoge.jpeg", "webp")).toBe("hoge.webp");
        expect(outputName("my.photo.GIF", "jpg")).toBe("my.photo.jpg");
        expect(outputName("noext", "webp")).toBe("noext.webp");
        expect(outputName("   ", "jpg")).toBe("image.jpg");
    });
});
