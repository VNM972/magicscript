(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/control-center/app/pain-first-intake/data:feac6f [app-client] (ecmascript) <text/javascript>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "inspectPainFirstCandidate",
    ()=>$$RSC_SERVER_ACTION_0
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-client-wrapper.js [app-client] (ecmascript)");
/* __next_internal_action_entry_do_not_use__ [{"40d08654944f390aeb5c294452e32aaf3d16f256b7":{"name":"inspectPainFirstCandidate"}},"apps/control-center/app/pain-first-intake/actions.ts",""] */ "use turbopack no side effects";
;
const $$RSC_SERVER_ACTION_0 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createServerReference"])("40d08654944f390aeb5c294452e32aaf3d16f256b7", __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["callServer"], void 0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$client$2d$wrapper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findSourceMapURL"], "inspectPainFirstCandidate");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/control-center/app/pain-first-intake/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ManualPainFirstIntakePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/pain-first-staging.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$control$2d$center$2f$app$2f$pain$2d$first$2d$intake$2f$submission$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/control-center/app/pain-first-intake/submission.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$control$2d$center$2f$app$2f$pain$2d$first$2d$intake$2f$data$3a$feac6f__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__ = __turbopack_context__.i("[project]/apps/control-center/app/pain-first-intake/data:feac6f [app-client] (ecmascript) <text/javascript>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const plans = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["painFirstQueryPlans"])();
function CandidateInspection({ candidate }) {
    _s();
    const started = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const [pending, setPending] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [diagnostic, setDiagnostic] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    async function inspect() {
        if (started.current) return;
        started.current = true;
        setPending(true);
        try {
            setDiagnostic(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$control$2d$center$2f$app$2f$pain$2d$first$2d$intake$2f$data$3a$feac6f__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$text$2f$javascript$3e$__["inspectPainFirstCandidate"])(candidate));
        } catch  {
            setDiagnostic({
                state: 'INSPECTION_FAILED'
            });
        } finally{
            setPending(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
        children: [
            candidate.conditionClass,
            " · ",
            candidate.resultPosition,
            " · ",
            candidate.resultUrl,
            ' ',
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                disabled: pending || diagnostic !== null,
                onClick: inspect,
                children: "Inspect"
            }, void 0, false, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 27,
                columnNumber: 10
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-live": "polite",
                "aria-label": "Résultat d’inspection",
                children: [
                    pending && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Inspection en cours…"
                    }, void 0, false, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 29,
                        columnNumber: 19
                    }, this),
                    diagnostic && (diagnostic.state === 'INSPECTED' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Transport"
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 31,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: diagnostic.observation.httpResultClass
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 31,
                                columnNumber: 27
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Page"
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 32,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: diagnostic.pageState
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 32,
                                columnNumber: 22
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Staging"
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 33,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: diagnostic.staging.state
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 33,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                children: "Autorité"
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 34,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                children: diagnostic.staging.authority
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 34,
                                columnNumber: 26
                            }, this),
                            diagnostic.staging.queryConditionClass && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Condition recherchée"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 35,
                                        columnNumber: 54
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        children: diagnostic.staging.queryConditionClass
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 35,
                                        columnNumber: 83
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 35,
                                columnNumber: 52
                            }, this),
                            diagnostic.staging.observedConditionClass && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Condition observée"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 36,
                                        columnNumber: 57
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        children: diagnostic.staging.observedConditionClass
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 36,
                                        columnNumber: 84
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 36,
                                columnNumber: 55
                            }, this),
                            diagnostic.staging.conditionConsistency && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Cohérence"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 37,
                                        columnNumber: 55
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        children: diagnostic.staging.conditionConsistency
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 37,
                                        columnNumber: 73
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 37,
                                columnNumber: 53
                            }, this),
                            diagnostic.observation.boundedTitle !== undefined && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Titre"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 38,
                                        columnNumber: 65
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        children: diagnostic.observation.boundedTitle
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 38,
                                        columnNumber: 79
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 38,
                                columnNumber: 63
                            }, this),
                            diagnostic.observation.boundedH1?.map((heading, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                            children: "H1"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                            lineNumber: 39,
                                            columnNumber: 85
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                            children: heading
                                        }, void 0, false, {
                                            fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                            lineNumber: 39,
                                            columnNumber: 96
                                        }, this)
                                    ]
                                }, index, true, {
                                    fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                    lineNumber: 39,
                                    columnNumber: 68
                                }, this)),
                            diagnostic.identity && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Identité"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 41,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        children: diagnostic.identity.identityState
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 41,
                                        columnNumber: 28
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                        children: "Portée de l’identité"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 42,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                        children: "NON_CANONICAL · CANDIDATE FACTS"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 42,
                                        columnNumber: 40
                                    }, this),
                                    diagnostic.identity.siren && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "SIREN"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 43,
                                                columnNumber: 43
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: diagnostic.identity.siren
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 43,
                                                columnNumber: 57
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 43,
                                        columnNumber: 41
                                    }, this),
                                    diagnostic.identity.siret && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "SIRET"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 44,
                                                columnNumber: 43
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: diagnostic.identity.siret
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 44,
                                                columnNumber: 57
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 44,
                                        columnNumber: 41
                                    }, this),
                                    diagnostic.identity.operatorName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Nom de l’entreprise"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 45,
                                                columnNumber: 50
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: diagnostic.identity.operatorName
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 45,
                                                columnNumber: 78
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 45,
                                        columnNumber: 48
                                    }, this),
                                    diagnostic.identity.municipality && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Commune"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 46,
                                                columnNumber: 50
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: diagnostic.identity.municipality
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 46,
                                                columnNumber: 66
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 46,
                                        columnNumber: 48
                                    }, this),
                                    diagnostic.identity.postcode && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Code postal"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 47,
                                                columnNumber: 46
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: diagnostic.identity.postcode
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 47,
                                                columnNumber: 66
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 47,
                                        columnNumber: 44
                                    }, this),
                                    diagnostic.identity.street && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Rue"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 48,
                                                columnNumber: 44
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: diagnostic.identity.street
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 48,
                                                columnNumber: 56
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 48,
                                        columnNumber: 42
                                    }, this),
                                    diagnostic.identity.streetNumber && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "Numéro"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 49,
                                                columnNumber: 50
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: diagnostic.identity.streetNumber
                                            }, void 0, false, {
                                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                                lineNumber: 49,
                                                columnNumber: 65
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 49,
                                        columnNumber: 48
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 40,
                                columnNumber: 33
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 30,
                        columnNumber: 58
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            diagnostic.state,
                            diagnostic.state === 'INVALID' ? ' · URL_REJECTED' : ''
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 51,
                        columnNumber: 15
                    }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 28,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
        lineNumber: 25,
        columnNumber: 10
    }, this);
}
_s(CandidateInspection, "BmTi/IPSkyKw+w16ql5iXbiuUbw=");
_c = CandidateInspection;
function ManualPainFirstIntakePage() {
    _s1();
    const [urls, setUrls] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    function submit(event) {
        event.preventDefault();
        setResult((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$control$2d$center$2f$app$2f$pain$2d$first$2d$intake$2f$submission$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mapManualPainFirstSubmission"])(urls, new Date().toISOString()));
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "deck-shell",
        style: {
            maxWidth: 960,
            margin: '0 auto',
            padding: 24
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/",
                children: "Retour au Control Center"
            }, void 0, false, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 64,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Intake manuel · Pain-first"
            }, void 0, false, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 65,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Recherchez ces deux requêtes dans votre navigateur, puis collez les URL candidates ci-dessous, une par ligne."
            }, void 0, false, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 66,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "La validation est locale. Inspect consulte uniquement la page d’accueil choisie, après un clic explicite. Aucun prospect créé."
            }, void 0, false, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 67,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Une URL saisie ne prouve ni identité, ni propriété du site, ni douleur digitale, ni admission."
            }, void 0, false, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 68,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                onSubmit: submit,
                children: [
                    plans.map((plan)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "operator-panel",
                            style: {
                                margin: '20px 0',
                                padding: 20
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    children: plan.conditionClass === 'SITE_UNDER_CONSTRUCTION' ? 'Site en construction' : 'Site en cours de refonte'
                                }, void 0, false, {
                                    fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                    lineNumber: 71,
                                    columnNumber: 9
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: plan.query
                                    }, void 0, false, {
                                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                        lineNumber: 72,
                                        columnNumber: 12
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                    lineNumber: 72,
                                    columnNumber: 9
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    htmlFor: plan.conditionClass,
                                    children: [
                                        "URL candidates · maximum ",
                                        __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAX_RESULTS_PER_QUERY"]
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                    lineNumber: 73,
                                    columnNumber: 9
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                    id: plan.conditionClass,
                                    value: urls[plan.conditionClass] ?? '',
                                    rows: 8,
                                    style: {
                                        display: 'block',
                                        width: '100%',
                                        marginTop: 8
                                    },
                                    onChange: (event)=>{
                                        setUrls({
                                            ...urls,
                                            [plan.conditionClass]: event.target.value
                                        });
                                        setResult(null);
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                    lineNumber: 74,
                                    columnNumber: 9
                                }, this)
                            ]
                        }, plan.planId, true, {
                            fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                            lineNumber: 70,
                            columnNumber: 28
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "submit",
                        children: "Valider et normaliser les URL"
                    }, void 0, false, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 78,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 69,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: "Les rejets et doublons comptent dans la limite de dix. Aucun remplacement automatique."
            }, void 0, false, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 80,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                children: [
                    "Inspect : une page d’accueil par clic, sans relance ni candidat suivant automatique. Limite du parcours : ",
                    __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAX_HOMEPAGE_FETCHES_PER_QUERY"],
                    " par condition."
                ]
            }, void 0, true, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 81,
                columnNumber: 5
            }, this),
            result && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                "aria-live": "polite",
                "aria-label": "Résultat de validation",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        children: [
                            "ACCEPTED : ",
                            result.acceptedCount,
                            " · REJECTED : ",
                            result.rejectedCount
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 83,
                        columnNumber: 7
                    }, this),
                    plans.map((plan)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: [
                                plan.query,
                                " — ACCEPTED : ",
                                result.candidates.filter((item)=>item.conditionClass === plan.conditionClass).length,
                                ' · REJECTED : ',
                                result.rejections.filter((item)=>item.conditionClass === plan.conditionClass).length
                            ]
                        }, plan.planId, true, {
                            fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                            lineNumber: 84,
                            columnNumber: 28
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: result.candidates.map((candidate)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CandidateInspection, {
                                candidate: candidate
                            }, `${candidate.providerRunId}:${candidate.resultUrl}`, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 86,
                                columnNumber: 49
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 86,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        children: result.rejections.map((rejection)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    rejection.conditionClass,
                                    " · ",
                                    rejection.resultPosition,
                                    " · ",
                                    rejection.reason
                                ]
                            }, `${rejection.conditionClass}:${rejection.resultPosition}`, true, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 88,
                                columnNumber: 49
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 88,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Candidats conservés uniquement dans cette page. Une nouvelle validation remplace le résultat courant."
                    }, void 0, false, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 91,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                children: "Objets candidats · autorité NONE"
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 92,
                                columnNumber: 16
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                style: {
                                    overflowX: 'auto'
                                },
                                children: JSON.stringify(result.candidates, null, 2)
                            }, void 0, false, {
                                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                                lineNumber: 93,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                        lineNumber: 92,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
                lineNumber: 82,
                columnNumber: 16
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/control-center/app/pain-first-intake/page.tsx",
        lineNumber: 63,
        columnNumber: 10
    }, this);
}
_s1(ManualPainFirstIntakePage, "3aCiTTpqUUtv+UpapQFdEh7BgWA=");
_c1 = ManualPainFirstIntakePage;
var _c, _c1;
__turbopack_context__.k.register(_c, "CandidateInspection");
__turbopack_context__.k.register(_c1, "ManualPainFirstIntakePage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/control-center/app/pain-first-intake/submission.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mapManualPainFirstSubmission",
    ()=>mapManualPainFirstSubmission
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$manual$2d$pain$2d$first$2d$intake$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/manual-pain-first-intake.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/pain-first-staging.ts [app-client] (ecmascript)");
;
;
function mapManualPainFirstSubmission(urlsByCondition, acquiredAt) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$manual$2d$pain$2d$first$2d$intake$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["intakeManualPainFirstUrls"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["painFirstQueryPlans"])().map((plan)=>({
            conditionClass: plan.conditionClass,
            urlsText: urlsByCondition[plan.conditionClass] ?? ''
        })), acquiredAt);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/contact-acquisition/agent.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OWNED_SITE_PATHS",
    ()=>OWNED_SITE_PATHS,
    "acquireContactSources",
    ()=>acquireContactSources,
    "bindCandidateIdentity",
    ()=>bindCandidateIdentity,
    "buildContactAcquisitionQueryPlan",
    ()=>buildContactAcquisitionQueryPlan,
    "classifySourceType",
    ()=>classifySourceType,
    "dedupeCandidates",
    ()=>dedupeCandidates,
    "fetchAndVerifyCandidates",
    ()=>fetchAndVerifyCandidates,
    "generatedOwnedPathManifest",
    ()=>generatedOwnedPathManifest,
    "normalizeCandidateUrl",
    ()=>normalizeCandidateUrl,
    "ownedSiteExplorationUrls",
    ()=>ownedSiteExplorationUrls,
    "sameOriginContactLinks",
    ()=>sameOriginContactLinks
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/evidence-integrity.ts [app-client] (ecmascript)");
;
const OWNED_SITE_PATHS = [
    '/contact',
    '/contactez-nous',
    '/nous-contacter',
    '/mentions-legales',
    '/mentions-légales',
    '/legal',
    '/about',
    '/a-propos'
];
function generatedOwnedPathManifest(websiteUrl, generatedAt) {
    const base = normalizeCandidateUrl(websiteUrl);
    if (!base) return [];
    return [
        {
            path: '/',
            pathOrigin: 'HOMEPAGE',
            normalizedUrl: base,
            generatedAt,
            lifecycle: 'GENERATED'
        },
        ...OWNED_SITE_PATHS.map((path)=>({
                path,
                pathOrigin: /mentions|legal/.test(path) ? 'GENERATED_LEGAL_PATH' : 'GENERATED_CONTACT_PATH',
                normalizedUrl: new URL(path, base).toString(),
                generatedAt,
                lifecycle: 'GENERATED'
            }))
    ];
}
function sameOriginContactLinks(homepageUrl, html, generatedAt) {
    const base = normalizeCandidateUrl(homepageUrl);
    if (!base) return [];
    const origin = new URL(base).origin;
    const out = [];
    for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)){
        try {
            const u = new URL(m[1], base);
            const path = u.pathname.toLowerCase();
            if (u.origin === origin && /(contact|contacter|mentions|legal|about|a-propos|à-propos)/i.test(path)) {
                const normalized = u.toString();
                if (!out.some((x)=>x.normalizedUrl === normalized)) out.push({
                    path: u.pathname,
                    pathOrigin: /mentions|legal/.test(path) ? 'GENERATED_LEGAL_PATH' : 'DISCOVERED_LINK',
                    normalizedUrl: normalized,
                    generatedAt,
                    lifecycle: 'GENERATED'
                });
            }
        } catch  {}
    }
    return out.slice(0, 5);
}
function ownedSiteExplorationUrls(websiteUrl) {
    const base = normalizeCandidateUrl(websiteUrl);
    if (!base) return [];
    return OWNED_SITE_PATHS.map((path)=>new URL(path, base).toString()).slice(0, OWNED_SITE_PATHS.length);
}
const clean = (value)=>value?.trim().replace(/\s+/g, ' ') || '';
const quote = (value)=>`"${clean(value)}"`;
function buildContactAcquisitionQueryPlan(identity) {
    const name = clean(identity.companyName), city = clean(identity.city), activity = clean(identity.activity), legal = clean(identity.legalName);
    const base = [
        [
            `${quote(name)} ${quote(city)} téléphone`,
            'phone'
        ],
        [
            `${quote(name)} ${quote(city)} contact`,
            'contact'
        ],
        [
            `${quote(name)} ${quote(city)} Instagram`,
            'instagram'
        ],
        [
            `${quote(name)} ${quote(city)} Facebook`,
            'facebook'
        ],
        [
            `${quote(name)} ${quote(activity)} ${quote(city)}`,
            'activity'
        ],
        [
            `${quote(legal || name)} ${quote(city)}`,
            'identity'
        ],
        [
            `${quote(name)} site officiel`,
            'website'
        ]
    ];
    const out = base.filter(([query])=>query.replace(/[" ]/g, '').length > 0).map(([query, purpose])=>({
            query,
            purpose
        }));
    if (identity.siren) out.push({
        query: `${quote(name)} ${quote(identity.siren)} contact`,
        purpose: 'identity'
    });
    if (identity.siret) out.push({
        query: `${quote(name)} ${quote(identity.siret)} téléphone`,
        purpose: 'phone'
    });
    return out.slice(0, 10);
}
function normalizeCandidateUrl(value) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(value)?.toString() ?? null;
}
function classifySourceType(url, verifiedWebsite = false) {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Repository authority: TavilySearchProvider.search and the R31 Google search capture.
    if (host === 'api.tavily.com') return 'SEARCH_PROVIDER';
    if (host === 'www.google.com') return 'SEARCH_ENGINE';
    if (host.includes('instagram.')) return 'INSTAGRAM';
    if (host.includes('facebook.')) return 'FACEBOOK';
    if (host.includes('tiktok.')) return 'TIKTOK';
    if (host.includes('wa.me') || host.includes('whatsapp.')) return 'WHATSAPP';
    if (host.includes('annuaire-entreprises') || host.includes('recherche-entreprises')) return 'REGISTRY';
    if (/(^|\.)(pagesjaunes\.fr|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|pappers\.fr|societe\.com|hoodspot\.fr|118000\.fr|kompass\.com)$/.test(host)) return 'BUSINESS_DIRECTORY';
    if (/(^|\.)(booking\.com|airbnb\.[a-z.]+)$/.test(host)) return 'BOOKING_PLATFORM';
    if (/contact|contactez|nous-contacter/.test(parsed.pathname.toLowerCase())) return 'CONTACT_PAGE';
    if (/mentions|legal/.test(parsed.pathname.toLowerCase())) return 'LEGAL_PAGE';
    if (verifiedWebsite && parsed.pathname === '/' && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(url)) return 'OWNED_WEBSITE';
    return 'OTHER_PUBLIC_SOURCE';
}
function dedupeCandidates(candidates) {
    const seen = new Set();
    return candidates.filter((candidate)=>{
        const normalized = normalizeCandidateUrl(candidate.url);
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        candidate.url = normalized;
        return true;
    }).slice(0, 30);
}
function bindCandidateIdentity(identity, candidate) {
    const text = `${candidate.text ?? ''} ${candidate.url}`.toLocaleLowerCase();
    const name = clean(identity.companyName).toLocaleLowerCase();
    const legal = clean(identity.legalName).toLocaleLowerCase();
    const domain = identity.websiteUrl ? new URL(identity.websiteUrl).hostname.replace(/^www\./, '').toLocaleLowerCase() : '';
    if (domain && candidate.url.toLocaleLowerCase().includes(domain)) return 'IDENTITY_VERIFIED';
    const city = clean(identity.city).toLocaleLowerCase();
    const hasDifferentCity = Boolean(city && /\b(paris|lyon|marseille|bordeaux|toulouse|nantes)\b/i.test(text) && !text.includes(city));
    if (hasDifferentCity) return 'IDENTITY_REJECTED';
    if (name && text.includes(name) && (!city || text.includes(city))) return 'IDENTITY_VERIFIED';
    if (legal && text.includes(legal) && (!city || text.includes(city))) return 'IDENTITY_VERIFIED';
    if (identity.city && text.includes(identity.city.toLocaleLowerCase())) return 'IDENTITY_PROBABLE';
    return 'IDENTITY_AMBIGUOUS';
}
async function fetchAndVerifyCandidates(identity, candidates, fetchPage) {
    const expanded = [
        ...candidates
    ];
    const owned = candidates.filter((candidate)=>candidate.sourceType === 'OWNED_WEBSITE' && candidate.identityStatus === 'IDENTITY_VERIFIED');
    for (const candidate of owned){
        try {
            const homepage = await fetchPage(candidate.url);
            if (homepage.ok) for (const link of sameOriginContactLinks(candidate.url, homepage.text ?? '', new Date().toISOString())){
                if (!expanded.some((item)=>item.url === link.normalizedUrl)) expanded.push({
                    url: link.normalizedUrl,
                    sourceType: classifySourceType(link.normalizedUrl),
                    queryOrigin: 'owned-site-discovered-link',
                    identityStatus: 'IDENTITY_VERIFIED',
                    identityEvidence: [
                        'same-origin bounded contact/legal link'
                    ],
                    fetchStatus: 'NOT_FETCHED'
                });
            }
        } catch  {}
        for (const url of ownedSiteExplorationUrls(candidate.url)){
            if (!expanded.some((item)=>item.url === url)) expanded.push({
                url,
                sourceType: classifySourceType(url),
                queryOrigin: 'owned-site-exploration',
                identityStatus: 'IDENTITY_VERIFIED',
                identityEvidence: [
                    'same-origin bounded fallback path'
                ],
                fetchStatus: 'NOT_FETCHED'
            });
        }
    }
    const bounded = dedupeCandidates(expanded).sort((a, b)=>(a.queryOrigin === 'owned-site-discovered-link' ? -1 : 0) - (b.queryOrigin === 'owned-site-discovered-link' ? -1 : 0)).slice(0, 30);
    for (const candidate of bounded){
        try {
            const fetched = await fetchPage(candidate.url);
            candidate.fetchStatus = fetched.ok ? 'FETCHED' : 'FETCH_FAILED';
            if (fetched.ok && candidate.identityStatus !== 'IDENTITY_VERIFIED') candidate.identityStatus = bindCandidateIdentity(identity, {
                url: candidate.url,
                text: fetched.text
            });
        } catch  {
            candidate.fetchStatus = 'FETCH_FAILED';
        }
    }
    return bounded;
}
async function acquireContactSources(identity, options = {}) {
    const startedAt = options.now ?? new Date().toISOString();
    const queries = buildContactAcquisitionQueryPlan(identity);
    const sources = [];
    const ownedPathManifest = identity.websiteUrl ? generatedOwnedPathManifest(identity.websiteUrl, startedAt) : [];
    if (identity.websiteUrl) {
        const url = normalizeCandidateUrl(identity.websiteUrl);
        if (url) sources.push({
            url,
            sourceType: 'OWNED_WEBSITE',
            queryOrigin: 'canonical.websiteUrl',
            identityStatus: 'IDENTITY_VERIFIED',
            identityEvidence: [
                'canonical website domain'
            ],
            fetchStatus: 'NOT_FETCHED'
        });
    }
    if (!options.provider) return {
        schemaVersion: 'contact-acquisition.v1',
        prospectId: options.prospectId,
        startedAt,
        completedAt: options.now ?? new Date().toISOString(),
        status: 'SEARCH_PROVIDER_UNAVAILABLE',
        queries,
        sources: dedupeCandidates(sources),
        sourceCounts: {
            canonical: sources.length
        },
        ownedPathManifest,
        blocker: {
            code: 'SEARCH_PROVIDER_UNAVAILABLE',
            detail: 'No authorized public search provider is configured.'
        }
    };
    let status = 'SEARCH_PROVIDER_AVAILABLE';
    let providerError = null;
    try {
        for (const query of queries){
            const results = await options.provider.search(query.query, 5);
            for (const result of results){
                const url = normalizeCandidateUrl(result.url);
                if (!url) continue;
                const identityStatus = bindCandidateIdentity(identity, {
                    url,
                    text: `${result.title ?? ''} ${result.snippet ?? ''}`
                });
                sources.push({
                    url,
                    sourceType: classifySourceType(url),
                    queryOrigin: query.query,
                    identityStatus,
                    identityEvidence: [
                        result.title ?? result.snippet ?? 'search result'
                    ],
                    fetchStatus: 'NOT_FETCHED'
                });
            }
        }
    } catch (error) {
        status = 'SEARCH_PROVIDER_FAILED';
        providerError = error instanceof Error ? error.message.replace(/TAVILY_API_KEY|api[_-]?key\s*[:=]\s*[^\s,}]+/gi, '[redacted]').slice(0, 240) : 'provider error';
    }
    const accepted = dedupeCandidates(sources);
    const blocked = accepted.filter((source)=>source.identityStatus === 'IDENTITY_AMBIGUOUS' || source.identityStatus === 'IDENTITY_REJECTED').length;
    return {
        schemaVersion: 'contact-acquisition.v1',
        prospectId: options.prospectId,
        startedAt,
        completedAt: options.now ?? new Date().toISOString(),
        status,
        queries,
        sources: accepted,
        sourceCounts: Object.fromEntries([
            ...new Set(accepted.map((s)=>s.sourceType))
        ].map((type)=>[
                type,
                accepted.filter((s)=>s.sourceType === type).length
            ])),
        ownedPathManifest,
        blocker: status === 'SEARCH_PROVIDER_FAILED' ? {
            code: 'SEARCH_PROVIDER_FAILED',
            detail: providerError ?? 'Configured provider failed.'
        } : blocked ? {
            code: 'IDENTITY_AMBIGUOUS',
            detail: `${blocked} candidate source(s) require rejection or review.`
        } : null
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/research/digital-pain-evidence.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "acceptedDigitalPainEvidence",
    ()=>acceptedDigitalPainEvidence,
    "canonicalNoticePhrase",
    ()=>canonicalNoticePhrase,
    "extractDigitalPainEvidence",
    ()=>extractDigitalPainEvidence,
    "inspectBrokenPrimaryAction",
    ()=>inspectBrokenPrimaryAction,
    "noticeType",
    ()=>noticeType
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/contact-acquisition/agent.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/evidence-integrity.ts [app-client] (ecmascript)");
;
;
const unknown = ()=>({
        status: 'UNKNOWN',
        observations: []
    });
const visibleText = (html)=>html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const validDigest = (value)=>typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
const observedAt = ()=>new Date().toISOString();
const validTime = (value)=>typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= Date.now() + 300_000;
const primaryActionLabel = /^(?:contact(?:ez[- ]nous)?|nous contacter|demander un devis|devis|réserver|réservation|book|booking|appeler|call|email|e-mail|postuler|apply|acheter|purchase)$/i;
function noticeType(value) {
    const text = value.normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '').toLowerCase();
    if (/^(?:notre |ce )?site (?:internet |web )?est en construction$/.test(text) || /^site (?:internet |web )?en construction$/.test(text) || /^(?:our )?website (?:is )?under construction$/.test(text)) return 'UNDER_CONSTRUCTION';
    if (/^(?:notre |ce )?site (?:internet |web )?est en cours de refonte$/.test(text) || /^site (?:internet |web )?en cours de refonte$/.test(text) || /^we are rebuilding (?:our|the) website$/.test(text)) return 'REBUILDING';
    return undefined;
}
function canonicalNoticePhrase(conditionClass) {
    return conditionClass === 'SITE_UNDER_CONSTRUCTION' ? 'site en construction' : 'site en cours de refonte';
}
function acceptedOwnedHomepage(source) {
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(source.url);
    return Boolean(url && (url.pathname === '/' || url.pathname === '/index.html') && source.supports.includes('website') && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(source.url, true) === 'OWNED_WEBSITE');
}
function extractDigitalPainEvidence(acceptedSources, pages, identity, verifiedOwnedWebsite = false) {
    const eligible = new Set(acceptedSources.filter(acceptedOwnedHomepage).map((source)=>source.url));
    const profiles = new Set(acceptedSources.filter((source)=>source.supports.includes('websiteAbsent') && [
            'FACEBOOK',
            'INSTAGRAM'
        ].includes((0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(source.url))).map((source)=>source.url));
    const websiteConflict = verifiedOwnedWebsite || eligible.size > 0 || acceptedSources.some((source)=>source.supports.includes('website') && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(source.url, true) === 'OWNED_WEBSITE');
    const observations = [];
    for (const page of pages){
        const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(page.url)?.toString();
        if (!url) continue;
        const when = page.observedAt ?? observedAt();
        if (!validTime(when) || !validDigest(page.snapshotDigest)) continue;
        if (profiles.has(url) && !websiteConflict && identity?.companyName && identity.city) {
            const title = visibleText(page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
            const body = visibleText(page.html);
            const norm = (text)=>text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
            const statement = body.match(/(?:nous n'avons pas de site (?:internet|web)|notre entreprise n'a pas de site (?:internet|web)|we do not have a website)[.!]?/i)?.[0];
            if (norm(title).includes(norm(identity.companyName)) && norm(body).includes(norm(identity.city)) && statement) {
                observations.push({
                    type: 'WEBSITE_VERIFIED_ABSENT',
                    observation: statement,
                    sourceUrl: url,
                    sourceType: 'VERIFIED_FIRST_PARTY_BUSINESS_PROFILE',
                    evidenceType: 'FIRST_PARTY_ABSENCE_STATEMENT',
                    integrityStatus: 'ACCEPTED',
                    inspectionMethod: 'FETCHED_FIRST_PARTY_STATEMENT',
                    observedAt: when,
                    snapshotDigest: page.snapshotDigest,
                    finalUrl: url,
                    supportingText: statement,
                    locator: 'profile-visible-text',
                    identityName: identity.companyName,
                    identityCity: identity.city,
                    conflictCheck: 'NO_VERIFIED_OWNED_WEBSITE'
                });
            }
        }
        if (!eligible.has(url)) continue;
        // A lone word in page copy, menu, article, or script is not a site-wide notice.
        for (const match of page.html.matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1>/gi)){
            const observation = visibleText(match[2]);
            const type = noticeType(observation);
            if (type && !observations.some((item)=>item.type === type && item.sourceUrl === url)) {
                observations.push({
                    type,
                    observation,
                    sourceUrl: url,
                    sourceType: 'OWNED_WEBSITE',
                    evidenceType: 'VISIBLE_SITE_NOTICE',
                    integrityStatus: 'ACCEPTED',
                    inspectionMethod: 'FETCHED_TITLE_H1',
                    observedAt: when,
                    snapshotDigest: page.snapshotDigest,
                    finalUrl: url,
                    supportingText: observation,
                    locator: match[1].toLowerCase()
                });
            }
        }
    }
    // Incompatible notices have no arbitrary precedence.
    return new Set(observations.map((item)=>item.type)).size === 1 ? {
        status: 'VERIFIED',
        observations
    } : unknown();
}
async function inspectBrokenPrimaryAction(source, page, fetchTarget, pause = ()=>new Promise((resolve)=>setTimeout(resolve, 1000))) {
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(page.url)?.toString();
    if (!url || url !== source.url || !source.supports.includes('website') || (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(source.url, true) !== 'OWNED_WEBSITE') return unknown();
    if (/<script\b|\bonclick\s*=|\bonmousedown\s*=/i.test(page.html)) return unknown();
    const actions = [
        ...page.html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)
    ].map((match, index)=>({
            label: visibleText(match[2]),
            href: match[1].match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1],
            marked: /\b(?:class|id|data-primary)\s*=\s*["'][^"']*(?:primary|cta)[^"']*["']/i.test(match[1]),
            locator: 'a[action=' + index + ']'
        })).filter((item)=>primaryActionLabel.test(item.label));
    if (actions.length !== 1 || !actions[0].marked || !actions[0].href) return unknown();
    const action = actions[0];
    const href = action.href;
    if (!href || /^(?:mailto:|tel:|javascript:|#)/i.test(href)) return unknown();
    let target;
    try {
        target = new URL(href, url);
    } catch  {}
    const when = page.observedAt ?? observedAt();
    if (!validTime(when) || !validDigest(page.snapshotDigest)) return unknown();
    let outcome;
    let trace;
    if (!target || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(target.toString())) {
        outcome = 'MALFORMED_TARGET';
    } else {
        const first = await fetchTarget(target.toString());
        if (first.ok || !/^HTTP_STATUS_(404|410|5\d\d)$/.test(first.reason) || first.redirectCount !== 0) return unknown();
        await pause();
        const second = await fetchTarget(target.toString());
        if (second.ok || second.reason !== first.reason || second.redirectCount !== 0) return unknown();
        const status = Number(first.reason.slice('HTTP_STATUS_'.length));
        outcome = status === 404 ? 'HTTP_404' : status === 410 ? 'HTTP_410' : 'HTTP_5XX_CORROBORATED';
        trace = [
            {
                checkedAt: when,
                targetUrl: target.toString(),
                status,
                redirectCount: 0
            },
            {
                checkedAt: observedAt(),
                targetUrl: target.toString(),
                status,
                redirectCount: 0
            }
        ];
    }
    const observation = {
        type: 'BROKEN_PRIMARY_ACTION',
        observation: action.label + ': ' + outcome,
        sourceUrl: url,
        sourceType: 'OWNED_WEBSITE',
        evidenceType: 'PRIMARY_ACTION_FAILURE',
        integrityStatus: 'ACCEPTED',
        inspectionMethod: 'SAFE_GET_ACTION_INSPECTION',
        observedAt: when,
        snapshotDigest: page.snapshotDigest,
        finalUrl: url,
        supportingText: action.label,
        locator: action.locator,
        targetUrl: target?.toString() ?? href,
        outcome,
        ...trace ? {
            trace
        } : {}
    };
    return {
        status: 'VERIFIED',
        observations: [
            observation
        ]
    };
}
function acceptedDigitalPainEvidence(value, sources, verifiedOwnedWebsite = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return unknown();
    const input = value;
    if (input.status !== 'VERIFIED' || !Array.isArray(input.observations)) return unknown();
    const observations = [];
    for (const raw of input.observations){
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return unknown();
        const item = raw;
        const source = sources.find((candidate)=>candidate.url === item.sourceUrl);
        if (!source || item.integrityStatus !== 'ACCEPTED' || !validTime(item.observedAt) || !validDigest(item.snapshotDigest) || item.finalUrl !== item.sourceUrl || typeof item.observation !== 'string' || !item.observation.trim() || typeof item.supportingText !== 'string' || !item.supportingText.trim() || typeof item.locator !== 'string') return unknown();
        if (item.type === 'UNDER_CONSTRUCTION' || item.type === 'REBUILDING') {
            if (!acceptedOwnedHomepage(source) || item.sourceType !== 'OWNED_WEBSITE' || item.evidenceType !== 'VISIBLE_SITE_NOTICE' || item.inspectionMethod !== 'FETCHED_TITLE_H1' || ![
                'title',
                'h1'
            ].includes(item.locator) || item.supportingText !== item.observation || noticeType(item.observation) !== item.type) return unknown();
        } else if (item.type === 'WEBSITE_VERIFIED_ABSENT') {
            if (!source.supports.includes('websiteAbsent') || ![
                'FACEBOOK',
                'INSTAGRAM'
            ].includes((0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(source.url)) || verifiedOwnedWebsite || sources.some((candidate)=>candidate.supports.includes('website') && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(candidate.url, true) === 'OWNED_WEBSITE') || item.sourceType !== 'VERIFIED_FIRST_PARTY_BUSINESS_PROFILE' || item.evidenceType !== 'FIRST_PARTY_ABSENCE_STATEMENT' || item.inspectionMethod !== 'FETCHED_FIRST_PARTY_STATEMENT' || item.conflictCheck !== 'NO_VERIFIED_OWNED_WEBSITE' || typeof item.identityName !== 'string' || !item.identityName.trim() || typeof item.identityCity !== 'string' || !item.identityCity.trim() || item.supportingText !== item.observation || !/(?:n'avons pas de site|n'a pas de site|do not have a website)/i.test(item.observation) || Date.now() - Date.parse(item.observedAt) > 30 * 24 * 60 * 60 * 1000) return unknown();
        } else if (item.type === 'BROKEN_PRIMARY_ACTION') {
            if (!source.supports.includes('website') || (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(source.url, true) !== 'OWNED_WEBSITE' || item.sourceType !== 'OWNED_WEBSITE' || item.evidenceType !== 'PRIMARY_ACTION_FAILURE' || item.inspectionMethod !== 'SAFE_GET_ACTION_INSPECTION' || typeof item.targetUrl !== 'string' || !primaryActionLabel.test(item.supportingText)) return unknown();
            if (item.outcome === 'MALFORMED_TARGET') {
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(item.targetUrl)) return unknown();
            } else {
                const status = item.outcome === 'HTTP_404' ? 404 : item.outcome === 'HTTP_410' ? 410 : undefined;
                if (!status && item.outcome !== 'HTTP_5XX_CORROBORATED') return unknown();
                const trace = item.trace;
                if (!Array.isArray(trace) || trace.length !== 2 || !trace.every((entry)=>entry && typeof entry === 'object' && validTime(entry.checkedAt) && entry.targetUrl === item.targetUrl && entry.redirectCount === 0 && (status ? entry.status === status : Number.isInteger(entry.status) && entry.status >= 500 && entry.status <= 599 && entry.status === trace[0].status))) return unknown();
            }
        } else return unknown();
        observations.push(item);
    }
    return observations.length && new Set(observations.map((item)=>item.type)).size === 1 ? {
        status: 'VERIFIED',
        observations
    } : unknown();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/research/digital-pain-preflight.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "inspectSuppliedDigitalPainPreflight",
    ()=>inspectSuppliedDigitalPainPreflight
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$digital$2d$pain$2d$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/digital-pain-evidence.ts [app-client] (ecmascript)");
;
function inspectSuppliedDigitalPainPreflight(input) {
    const base = {
        authority: 'NON_AUTHORITATIVE'
    };
    const unknown = (reason)=>({
            ...base,
            state: 'UNKNOWN',
            condition: null,
            reason,
            matchedText: null
        });
    if (!input || typeof input !== 'object' || Array.isArray(input)) return unknown('UNSUPPORTED_CONTENT');
    if (input.seedProvenance !== undefined) {
        const provenance = input.seedProvenance;
        if (!provenance || ![
            'CANDIDATE_URL',
            'FACTUAL_ORIGIN'
        ].includes(provenance.kind) || typeof provenance.reference !== 'string' || !provenance.reference.trim()) return unknown('UNSUPPORTED_CONTENT');
        // Copy only the narrow bookkeeping fields, never arbitrary caller authority fields.
        base.seedProvenance = {
            kind: provenance.kind,
            reference: provenance.reference
        };
    }
    if (typeof input.origin !== 'string' || !input.origin.trim()) return unknown('MISSING_ORIGIN');
    const content = input.content;
    if (content === undefined || content === null) return unknown('MISSING_CONTENT');
    if (typeof content !== 'object' || Array.isArray(content) || content.kind !== 'TITLE_H1' || content.title !== undefined && typeof content.title !== 'string' || content.h1 !== undefined && (!Array.isArray(content.h1) || Array.from(content.h1).some((text)=>typeof text !== 'string'))) {
        return unknown('UNSUPPORTED_CONTENT');
    }
    const texts = [
        content.title ?? '',
        ...content.h1 ?? []
    ].filter((text)=>text.trim());
    if (!texts.length) return unknown('MISSING_CONTENT');
    // Markup, replacement characters and non-whitespace controls are not safely extracted text.
    if (texts.some((text)=>/[<>\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text))) {
        return unknown('UNUSABLE_CONTENT');
    }
    let signal;
    for (const text of texts){
        const type = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$digital$2d$pain$2d$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["noticeType"])(text);
        if (type !== 'UNDER_CONSTRUCTION' && type !== 'REBUILDING') continue;
        const condition = type === 'UNDER_CONSTRUCTION' ? 'SITE_UNDER_CONSTRUCTION' : 'SITE_REBUILDING';
        if (signal && signal.condition !== condition) return unknown('CONFLICTING_NOTICES');
        signal ??= {
            condition,
            matchedText: text
        };
    }
    return signal ? {
        ...base,
        ...signal,
        state: 'LIKELY_CANONICAL_PAIN',
        reason: 'CANONICAL_NOTICE_MATCHED'
    } : {
        ...base,
        state: 'NO_PAIN_SIGNAL',
        condition: null,
        reason: 'NO_CANONICAL_NOTICE',
        matchedText: null
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/research/evidence-integrity.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RESEARCH_EVIDENCE_CLAIMS",
    ()=>RESEARCH_EVIDENCE_CLAIMS,
    "RESEARCH_SCORE_KEYS",
    ()=>RESEARCH_SCORE_KEYS,
    "evaluateResearchEvidenceIntegrity",
    ()=>evaluateResearchEvidenceIntegrity,
    "evaluateResearchPhoneEvidenceIntegrity",
    ()=>evaluateResearchPhoneEvidenceIntegrity,
    "hasSupportedResearchClaim",
    ()=>hasSupportedResearchClaim,
    "isRejectedHostAddress",
    ()=>isRejectedHostAddress,
    "publicHttpUrl",
    ()=>publicHttpUrl
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$phone$2d$extractor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/phone-extractor.ts [app-client] (ecmascript)");
const RESEARCH_SCORE_KEYS = [
    'digitalGap',
    'commercialStrength',
    'contactability',
    'localFit',
    'prototypeLeverage',
    'confidence'
];
const RESEARCH_EVIDENCE_CLAIMS = [
    'digitalGap',
    'commercialStrength',
    'contactability',
    'localFit',
    'prototypeLeverage',
    'activity',
    'location',
    'website',
    'websiteAbsent',
    'publicListing',
    'bookingPlatform',
    'menuProvider',
    'eventPlatform',
    'phone',
    'opportunity',
    'primaryAsset',
    'primaryFriction',
    'brandAsset'
];
const claims = new Set(RESEARCH_EVIDENCE_CLAIMS);
const scoreEvidenceClaims = RESEARCH_SCORE_KEYS.filter((key)=>key !== 'confidence');
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function rejectedIpv4Literal(host) {
    return /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^0\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
function parseIpv6Words(host) {
    const literal = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
    if (!literal.includes(':')) return null;
    const halves = literal.split('::');
    if (halves.length > 2) return null;
    const parseHalf = (half)=>{
        if (!half) return [];
        const rawWords = half.split(':');
        if (rawWords.some((word)=>!/^[0-9a-f]{1,4}$/i.test(word))) return null;
        return rawWords.map((word)=>Number.parseInt(word, 16));
    };
    const left = parseHalf(halves[0] ?? '');
    const right = parseHalf(halves[1] ?? '');
    if (!left || !right) return null;
    if (halves.length === 1) return left.length === 8 ? left : null;
    const omittedWordCount = 8 - left.length - right.length;
    if (omittedWordCount < 1) return null;
    return [
        ...left,
        ...Array(omittedWordCount).fill(0),
        ...right
    ];
}
function rejectedIpv6Literal(host) {
    const words = parseIpv6Words(host);
    if (!words) return false;
    const unspecified = words.every((word)=>word === 0);
    const loopback = words.slice(0, 7).every((word)=>word === 0) && words[7] === 1;
    const uniqueLocal = (words[0] & 0xfe00) === 0xfc00;
    const linkLocal = (words[0] & 0xffc0) === 0xfe80;
    const ipv4Mapped = words.slice(0, 5).every((word)=>word === 0) && words[5] === 0xffff;
    const mappedIpv4 = ipv4Mapped ? `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}` : null;
    return unspecified || loopback || uniqueLocal || linkLocal || mappedIpv4 !== null && rejectedIpv4Literal(mappedIpv4);
}
function isRejectedHostAddress(host) {
    const lower = host.toLowerCase();
    const mappedIpv4 = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
    return !lower || lower === 'localhost' || lower.endsWith('.local') || rejectedIpv4Literal(lower) || rejectedIpv6Literal(lower) || mappedIpv4 !== undefined && rejectedIpv4Literal(mappedIpv4);
}
function publicHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        const host = url.hostname.toLowerCase();
        if (url.protocol !== 'http:' && url.protocol !== 'https:' || url.username || url.password || isRejectedHostAddress(host)) return null;
        url.hash = '';
        return url;
    } catch  {
        return null;
    }
}
function normalizeSources(value) {
    if (!Array.isArray(value)) return {
        accepted: [],
        rejected: value === undefined ? 0 : 1
    };
    const accepted = [];
    let rejected = 0;
    const seen = new Set();
    for (const item of value){
        const source = record(item);
        const url = publicHttpUrl(source?.url);
        const note = typeof source?.note === 'string' ? source.note.trim() : '';
        const rawSupports = source && Array.isArray(source.supports) ? source.supports : [];
        const supports = [
            ...new Set(rawSupports.filter((claim)=>typeof claim === 'string' && claims.has(claim)))
        ];
        if (!url || !note || supports.length === 0) {
            rejected += 1;
            continue;
        }
        const normalizedUrl = url.toString();
        const key = `${normalizedUrl}|${supports.join(',')}|${note}`;
        if (seen.has(key)) continue;
        seen.add(key);
        accepted.push({
            url: normalizedUrl,
            note,
            supports
        });
    }
    return {
        accepted,
        rejected
    };
}
function evaluateResearchPhoneEvidenceIntegrity(input) {
    const sources = normalizeSources(input.sources);
    const derived = input.derivedPhoneEvidence;
    // V1: source-backed independent phone evidence (from fetch + extraction)
    const hasIndependentEvidence = typeof derived === 'object' && derived !== null && derived.independentlyObserved === true && derived.evidenceOrigin === 'FETCHED_SOURCE' && typeof derived.phone === 'string' && typeof derived.normalizedDigits === 'string' && typeof derived.sourceUrl === 'string' && typeof derived.evidenceType === 'string';
    if (hasIndependentEvidence) {
        const evidencePhone = derived.phone;
        const evidenceDigits = derived.normalizedDigits;
        const evidenceSourceUrl = derived.sourceUrl;
        const evidenceType = derived.evidenceType;
        const sourceOwnership = derived.sourceOwnership;
        const entityBound = derived.entityBound;
        // Validate phone syntax and bind the normalized representation to the
        // independently observed value. Callers cannot attest one phone while
        // supplying the digits of another.
        const normalizedEvidencePhone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$phone$2d$extractor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizePhoneDigits"])(evidencePhone);
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$phone$2d$extractor$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["looksLikePhone"])(evidencePhone) || normalizedEvidencePhone.length < 8 || normalizedEvidencePhone.length > 15 || evidenceDigits !== normalizedEvidencePhone) {
            return {
                acceptedSources: sources.accepted,
                rejectedSourceCount: sources.rejected,
                reason: 'MALFORMED_PHONE_EVIDENCE'
            };
        }
        // Validate evidence source URL is public
        const evidenceUrl = publicHttpUrl(evidenceSourceUrl);
        if (!evidenceUrl) {
            return {
                acceptedSources: sources.accepted,
                rejectedSourceCount: sources.rejected,
                reason: 'MALFORMED_PHONE_EVIDENCE'
            };
        }
        // Validate evidence type
        const validTypes = new Set([
            'TEL_HREF',
            'JSON_LD_TELEPHONE',
            'VISIBLE_PAGE_TEXT'
        ]);
        if (!validTypes.has(evidenceType) || sourceOwnership === 'THIRD_PARTY_SITE_GLOBAL_CONTACT' || sourceOwnership === 'AMBIGUOUS_SOURCE_OWNERSHIP' || sourceOwnership === 'UNKNOWN' || entityBound === false) {
            return {
                acceptedSources: sources.accepted,
                rejectedSourceCount: sources.rejected,
                reason: 'MALFORMED_PHONE_EVIDENCE'
            };
        }
        // The deterministic runner appends the fetched page as an accepted phone
        // source. Model-authored supports alone cannot reach this branch because
        // derivedPhoneEvidence is stripped before runner enrichment.
        if (!sources.accepted.some((source)=>source.url === evidenceUrl.toString() && source.supports.includes('phone'))) {
            return {
                acceptedSources: sources.accepted,
                rejectedSourceCount: sources.rejected,
                reason: 'UNSUPPORTED_PHONE'
            };
        }
        const trustedPhone = {
            phone: evidencePhone,
            normalizedDigits: evidenceDigits,
            sourceUrl: evidenceUrl.toString(),
            evidenceType: evidenceType,
            evidenceOrigin: 'FETCHED_SOURCE',
            independentlyObserved: true,
            ...sourceOwnership ? {
                sourceOwnership
            } : {},
            ...entityBound === true ? {
                entityBound: true
            } : {}
        };
        // If a model phone was also provided and disagrees, record discrepancy
        const modelPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
        const modelDigits = modelPhone.replace(/\D/g, '');
        if (modelPhone && modelDigits !== evidenceDigits) {
            return {
                acceptedSources: sources.accepted,
                rejectedSourceCount: sources.rejected,
                trustedPhone,
                reason: 'DERIVED_PHONE_DISAGREES_WITH_MODEL'
            };
        }
        return {
            acceptedSources: sources.accepted,
            rejectedSourceCount: sources.rejected,
            trustedPhone
        };
    }
    // No independent evidence: model-only path is fail-closed.
    if (typeof input.phone !== 'string' || !input.phone.trim()) {
        return {
            acceptedSources: sources.accepted,
            rejectedSourceCount: sources.rejected
        };
    }
    const phone = input.phone.trim();
    const digits = phone.replace(/\D/g, '');
    const phoneSource = publicHttpUrl(input.phoneSourceUrl);
    if (digits.length < 8 || digits.length > 15 || !phoneSource) {
        return {
            acceptedSources: sources.accepted,
            rejectedSourceCount: sources.rejected,
            reason: 'MALFORMED_PHONE_EVIDENCE'
        };
    }
    // All available inputs (phone, phoneSourceUrl, source.url, source.note,
    // source.supports, derivedClaims) originate from the LLM research swarm and
    // alone cannot break the model-claim → evidence circuit.
    return {
        acceptedSources: sources.accepted,
        rejectedSourceCount: sources.rejected,
        reason: 'UNSUPPORTED_PHONE'
    };
}
function normalizeScores(value) {
    const source = record(value);
    const values = Object.fromEntries(RESEARCH_SCORE_KEYS.map((key)=>[
            key,
            0
        ]));
    let valid = Boolean(source);
    for (const key of RESEARCH_SCORE_KEYS){
        const score = source?.[key];
        if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
            valid = false;
            continue;
        }
        values[key] = score;
    }
    return {
        values,
        valid
    };
}
function sameOrigin(left, right) {
    const parsed = publicHttpUrl(left);
    return parsed?.origin === right.origin;
}
function evaluateResearchEvidenceIntegrity(input) {
    const reasons = [];
    const phoneIntegrity = evaluateResearchPhoneEvidenceIntegrity({
        ...input,
        derivedClaims: input.derivedClaims
    });
    const sources = {
        accepted: [
            ...phoneIntegrity.acceptedSources
        ],
        rejected: phoneIntegrity.rejectedSourceCount
    };
    const scores = normalizeScores(input.scoreInputs);
    const supported = new Set(sources.accepted.flatMap((source)=>[
            ...source.supports
        ]));
    // Merge deterministically derived claims — these are claims that the system
    // can reason about from source-backed facts without an explicit annotation.
    if (Array.isArray(input.derivedClaims)) {
        for (const claim of input.derivedClaims){
            if (claims.has(claim)) supported.add(claim);
        }
    }
    // SECURITY INVARIANT: phone and contactability claims must NOT be accepted
    // from model-authored source.supports or derivedClaims alone. They are only
    // valid when independent deterministic phone evidence exists (trustedPhone).
    // This gate runs AFTER the derived-claims merge so that even a derived
    // phone/contactability claim cannot bypass the independent-evidence requirement.
    if (phoneIntegrity.trustedPhone) {
        // Independent evidence exists — promote phone and contactability regardless
        // of whether they were in source.supports or derivedClaims.
        supported.add('phone');
        supported.add('contactability');
    } else {
        // No independent evidence — strip any phone/contactability that may have
        // been added by source.supports or derivedClaims.
        supported.delete('phone');
        supported.delete('contactability');
    }
    if (sources.accepted.length === 0) reasons.push('MISSING_ACCEPTED_SOURCES');
    if (!scores.valid) reasons.push('MALFORMED_SCORE_INPUTS');
    for (const key of scoreEvidenceClaims){
        if (scores.values[key] > 0 && !supported.has(key)) reasons.push(`UNSUPPORTED_SCORE:${key}`);
    }
    let trustedWebsiteUrl;
    if (typeof input.websiteUrl === 'string' && input.websiteUrl.trim()) {
        const website = publicHttpUrl(input.websiteUrl);
        if (!website) reasons.push('MALFORMED_WEBSITE');
        else if (sources.accepted.some((source)=>source.supports.includes('website') && sameOrigin(source.url, website))) trustedWebsiteUrl = website.toString();
        else reasons.push('UNSUPPORTED_WEBSITE');
    }
    if (phoneIntegrity.reason) reasons.push(phoneIntegrity.reason);
    const blockingReasons = reasons.filter((reason)=>reason === 'MISSING_ACCEPTED_SOURCES' || reason === 'MALFORMED_SCORE_INPUTS' || reason.startsWith('UNSUPPORTED_SCORE:'));
    return {
        passed: blockingReasons.length === 0,
        reasons,
        acceptedSources: sources.accepted,
        rejectedSourceCount: sources.rejected,
        supportedClaims: RESEARCH_EVIDENCE_CLAIMS.filter((claim)=>supported.has(claim)),
        scoreInputs: scores.values,
        ...trustedWebsiteUrl ? {
            trustedWebsiteUrl
        } : {},
        ...phoneIntegrity.trustedPhone ? {
            trustedPhone: phoneIntegrity.trustedPhone
        } : {}
    };
}
function hasSupportedResearchClaim(result, claim) {
    return result.supportedClaims.includes(claim);
}
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/research/manual-pain-first-intake.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "intakeManualPainFirstUrls",
    ()=>intakeManualPainFirstUrls
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/pain-first-staging.ts [app-client] (ecmascript)");
;
function intakeManualPainFirstUrls(submissions, acquiredAt) {
    const plans = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["painFirstQueryPlans"])();
    const candidates = [];
    const rejections = [];
    const positions = new Map();
    const seen = new Set();
    for (const submission of submissions){
        const plan = plans.find((item)=>item.conditionClass === submission.conditionClass);
        for (const resultUrl of submission.urlsText.split(/\r?\n/).map((line)=>line.trim()).filter(Boolean)){
            const resultPosition = (positions.get(submission.conditionClass) ?? 0) + 1;
            positions.set(submission.conditionClass, resultPosition);
            const reject = (reason)=>rejections.push({
                    conditionClass: submission.conditionClass,
                    resultPosition,
                    reason
                });
            if (!plan) {
                reject('CONDITION_REJECTED');
                continue;
            }
            // Rejected and duplicate inputs still consume their submitted position: no fill pressure.
            if (resultPosition > __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAX_RESULTS_PER_QUERY"]) {
                reject('INPUT_LIMIT');
                continue;
            }
            const candidate = {
                schemaVersion: 1,
                queryPlanId: plan.planId,
                conditionClass: plan.conditionClass,
                providerClass: 'MANUAL_OPERATOR',
                providerRunId: `manual-operator:${acquiredAt}`,
                resultUrl,
                resultPosition,
                acquiredAt,
                authority: 'NONE'
            };
            // The R55 filter owns public URL validation, normalization, and source classification.
            const accepted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$pain$2d$first$2d$staging$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["acceptPainFirstSearchCandidate"])(candidate);
            if (accepted.state !== 'URL_ACCEPTED') {
                reject('URL_REJECTED');
                continue;
            }
            if (seen.has(accepted.homepageUrl)) {
                reject('DUPLICATE_URL');
                continue;
            }
            seen.add(accepted.homepageUrl);
            candidates.push({
                ...candidate,
                resultUrl: accepted.homepageUrl
            });
        }
    }
    return {
        candidates,
        rejections,
        acceptedCount: candidates.length,
        rejectedCount: rejections.length
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/research/pain-first-staging.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MAX_HOMEPAGE_FETCHES_PER_QUERY",
    ()=>MAX_HOMEPAGE_FETCHES_PER_QUERY,
    "MAX_REGISTRY_REQUESTS_PER_CANDIDATE",
    ()=>MAX_REGISTRY_REQUESTS_PER_CANDIDATE,
    "MAX_RESULTS_PER_QUERY",
    ()=>MAX_RESULTS_PER_QUERY,
    "MAX_SEARCH_REQUESTS_PER_CYCLE",
    ()=>MAX_SEARCH_REQUESTS_PER_CYCLE,
    "RETRIES",
    ()=>RETRIES,
    "acceptPainFirstSearchCandidate",
    ()=>acceptPainFirstSearchCandidate,
    "candidateFromPainFirstAcceptance",
    ()=>candidateFromPainFirstAcceptance,
    "painFirstQueryPlans",
    ()=>painFirstQueryPlans,
    "painFirstTransition",
    ()=>painFirstTransition,
    "readyForProspectCreation",
    ()=>readyForProspectCreation,
    "registryRequestFromIdentity",
    ()=>registryRequestFromIdentity,
    "stagePainFirstSuppliedPage",
    ()=>stagePainFirstSuppliedPage,
    "validRegistryReconciliationRequest",
    ()=>validRegistryReconciliationRequest,
    "validRegistryReconciliationResult",
    ()=>validRegistryReconciliationResult
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/contact-acquisition/agent.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$digital$2d$pain$2d$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/digital-pain-evidence.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$digital$2d$pain$2d$preflight$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/digital-pain-preflight.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/evidence-integrity.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/website-seed.ts [app-client] (ecmascript)");
;
;
;
;
;
const MAX_SEARCH_REQUESTS_PER_CYCLE = 2;
const MAX_RESULTS_PER_QUERY = 10;
const MAX_HOMEPAGE_FETCHES_PER_QUERY = 3;
const MAX_REGISTRY_REQUESTS_PER_CANDIDATE = 1;
const RETRIES = 0;
function painFirstQueryPlans() {
    return [
        'SITE_UNDER_CONSTRUCTION',
        'SITE_REBUILDING'
    ].map((conditionClass)=>{
        const canonicalSearchPhrase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$digital$2d$pain$2d$evidence$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalNoticePhrase"])(conditionClass);
        return {
            schemaVersion: 1,
            planId: `pain-first:1:${conditionClass}:${encodeURIComponent(canonicalSearchPhrase)}:MQ`,
            conditionClass,
            canonicalNoticeType: conditionClass,
            canonicalSearchPhrase,
            query: `${canonicalSearchPhrase} Martinique`,
            geography: {
                country: 'MQ',
                label: 'Martinique'
            },
            maxProviderRequests: 1
        };
    });
}
const acceptedCandidates = new WeakMap();
function candidateFromPainFirstAcceptance(accepted) {
    return acceptedCandidates.get(accepted);
}
function acceptPainFirstSearchCandidate(candidate) {
    const plan = painFirstQueryPlans().find((item)=>item.planId === candidate?.queryPlanId && item.conditionClass === candidate.conditionClass);
    if (!plan || candidate.schemaVersion !== 1 || candidate.authority !== 'NONE' || !candidate.providerClass?.trim() || !candidate.providerRunId?.trim() || !Number.isInteger(candidate.resultPosition) || candidate.resultPosition < 1 || candidate.resultPosition > MAX_RESULTS_PER_QUERY || candidate.resultTitle !== undefined && (typeof candidate.resultTitle !== 'string' || candidate.resultTitle.length > 200) || !Number.isFinite(Date.parse(candidate.acquiredAt))) return {
        state: 'URL_REJECTED'
    };
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(candidate.resultUrl);
    const normalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeCandidateUrl"])(candidate.resultUrl);
    if (!url || !normalized || url.search || ![
        '/',
        '/index.html'
    ].includes(url.pathname) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(normalized) !== 'OTHER_PUBLIC_SOURCE') return {
        state: 'URL_REJECTED'
    };
    const accepted = Object.freeze({
        state: 'URL_ACCEPTED',
        homepageUrl: normalized
    });
    acceptedCandidates.set(accepted, Object.freeze({
        ...candidate,
        resultUrl: normalized
    }));
    return accepted;
}
function stagePainFirstSuppliedPage(candidate, observation, options) {
    const accepted = acceptPainFirstSearchCandidate(candidate);
    if (accepted.state !== 'URL_ACCEPTED') throw new Error('URL_REJECTED');
    const requested = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeCandidateUrl"])(observation?.requestedUrl);
    const final = observation?.finalUrl === undefined ? requested : (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeCandidateUrl"])(observation.finalUrl);
    if (observation?.schemaVersion !== 1 || observation.httpResultClass !== 'SUCCESS' || !requested || requested !== accepted.homepageUrl || final !== requested || !Number.isFinite(Date.parse(observation.inspectedAt)) || observation.boundedTitle !== undefined && (typeof observation.boundedTitle !== 'string' || observation.boundedTitle.length > 512) || observation.boundedH1 !== undefined && (!Array.isArray(observation.boundedH1) || observation.boundedH1.length > 4 || observation.boundedH1.some((text)=>typeof text !== 'string' || text.length > 512)) || observation.suppliedHtml !== undefined && (typeof observation.suppliedHtml !== 'string' || observation.suppliedHtml.length > 250_000) || observation.identitySafeSubset !== undefined && (typeof observation.identitySafeSubset !== 'string' || observation.identitySafeSubset.length > 250_000) || observation.contentType && !/^text\/html(?:\s*;|$)/i.test(observation.contentType)) {
        return {
            state: 'FETCH_FAILED',
            authority: 'NON_AUTHORITATIVE'
        };
    }
    const preflight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$digital$2d$pain$2d$preflight$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["inspectSuppliedDigitalPainPreflight"])({
        origin: requested,
        seedProvenance: {
            kind: 'CANDIDATE_URL',
            reference: requested
        },
        content: {
            kind: 'TITLE_H1',
            title: observation.boundedTitle,
            h1: observation.boundedH1
        }
    });
    if (preflight.state === 'NO_PAIN_SIGNAL') return {
        state: painFirstTransition('PAGE_OBSERVED', 'NO_PAIN_SIGNAL', {
            preflight
        }),
        authority: 'NON_AUTHORITATIVE'
    };
    if (preflight.state === 'UNKNOWN') return {
        state: painFirstTransition('PAGE_OBSERVED', 'PAIN_UNKNOWN', {
            preflight
        }),
        authority: 'NON_AUTHORITATIVE'
    };
    painFirstTransition('PAGE_OBSERVED', 'PAIN_SIGNAL_CONFIRMED', {
        preflight
    });
    const audit = {
        authority: 'NON_AUTHORITATIVE',
        queryConditionClass: candidate.conditionClass,
        observedConditionClass: preflight.condition,
        conditionConsistency: candidate.conditionClass === preflight.condition ? 'MATCH' : 'MISMATCH'
    };
    if (options?.stopAfterPainSignal) return {
        ...audit,
        state: 'PAIN_SIGNAL_CONFIRMED'
    };
    const extracted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["extractSuppliedFirstPartyIdentity"])(observation.suppliedHtml ?? observation.identitySafeSubset ?? '');
    if (extracted.state !== 'IDENTITY_STRONG') {
        painFirstTransition('PAIN_SIGNAL_CONFIRMED', extracted.state, {
            identity: extracted
        });
        return {
            ...audit,
            state: extracted.state
        };
    }
    painFirstTransition('PAIN_SIGNAL_CONFIRMED', 'IDENTITY_EXTRACTED', {
        identity: extracted
    });
    if (!extracted.identity) throw new Error('IDENTITY_PROOF_REQUIRED');
    return {
        ...audit,
        state: 'IDENTITY_EXTRACTED',
        identity: extracted.identity
    };
}
function validRegistryReconciliationRequest(request) {
    if (request?.schemaVersion !== 1 || request.source !== 'PAIN_FIRST' || !request.candidateId?.trim() || !Number.isFinite(Date.parse(request.requestedAt))) return false;
    if (request.lookupMode === 'SIRET') return typeof request.directSiret === 'string' && !('directSiren' in request) && !('exactOperatorName' in request) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validRegistration"])(request.directSiret, 14);
    if (request.lookupMode === 'SIREN') return typeof request.directSiren === 'string' && !('directSiret' in request) && !('exactOperatorName' in request) && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validRegistration"])(request.directSiren, 9);
    return request.lookupMode === 'NAME_ADDRESS' && !('directSiret' in request) && !('directSiren' in request) && Boolean(request.exactOperatorName?.trim() && request.postcode?.trim() && (request.municipality?.trim() || request.street?.trim()));
}
function registryRequestFromIdentity(candidateId, requestedAt, identity) {
    const base = {
        schemaVersion: 1,
        source: 'PAIN_FIRST',
        candidateId,
        requestedAt
    };
    const request = identity.directSiret ? {
        ...base,
        lookupMode: 'SIRET',
        directSiret: identity.directSiret
    } : identity.directSiren ? {
        ...base,
        lookupMode: 'SIREN',
        directSiren: identity.directSiren
    } : {
        ...base,
        lookupMode: 'NAME_ADDRESS',
        exactOperatorName: identity.exactOperatorName ?? '',
        municipality: identity.municipality,
        postcode: identity.postcode,
        street: identity.street,
        streetNumber: identity.streetNumber
    };
    return validRegistryReconciliationRequest(request) ? request : null;
}
function validRegistryReconciliationResult(result) {
    if (result?.schemaVersion !== 1 || !result.candidateId?.trim() || !Number.isFinite(Date.parse(result.completedAt))) return false;
    switch(result.state){
        case 'ZERO_MATCH':
            return result.matchCount === 0;
        case 'MULTIPLE_MATCHES':
            return Number.isInteger(result.matchCount) && result.matchCount >= 2;
        case 'PROVIDER_FAILURE':
            return Boolean(result.failureCode?.trim());
        case 'UNIQUE_MATCH':
            return result.matchCount === 1 && [
                'SIRET',
                'SIREN',
                'NAME_ADDRESS'
            ].includes(result.exactMatchProvenance?.lookupMode) && typeof result.canonicalSiren === 'string' && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validRegistration"])(result.canonicalSiren, 9) && (result.canonicalSiret === undefined || typeof result.canonicalSiret === 'string' && (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validRegistration"])(result.canonicalSiret, 14) && result.canonicalSiret.slice(0, 9) === result.canonicalSiren) && Boolean(result.canonicalEnterpriseName?.trim() && result.canonicalEstablishmentIdentity?.trim() && result.municipality?.trim() && /^972\d{2}$/.test(result.postcode));
        default:
            return false;
    }
}
function readyForProspectCreation(request, result, factualOperatorName) {
    if (!validRegistryReconciliationRequest(request) || !validRegistryReconciliationResult(result) || result.candidateId !== request.candidateId || result.state !== 'UNIQUE_MATCH' || result.matchCount !== 1 || result.exactMatchProvenance?.lookupMode !== request.lookupMode || !factualOperatorName?.trim() || !result.canonicalEnterpriseName?.trim() || !result.canonicalEstablishmentIdentity?.trim() || !result.municipality?.trim() || !/^972\d{2}$/.test(result.postcode) || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validRegistration"])(result.canonicalSiren, 9) || !result.canonicalSiret || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$website$2d$seed$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validRegistration"])(result.canonicalSiret, 14) || result.canonicalSiret.slice(0, 9) !== result.canonicalSiren) return false;
    return request.lookupMode === 'SIRET' ? result.canonicalSiret === request.directSiret : request.lookupMode === 'SIREN' ? result.canonicalSiren === request.directSiren : true;
}
const transitions = {
    SEARCH_CANDIDATE: [
        'URL_ACCEPTED',
        'URL_REJECTED'
    ],
    URL_ACCEPTED: [
        'PAGE_OBSERVED',
        'FETCH_FAILED'
    ],
    PAGE_OBSERVED: [
        'PAIN_SIGNAL_CONFIRMED',
        'NO_PAIN_SIGNAL',
        'PAIN_UNKNOWN'
    ],
    PAIN_SIGNAL_CONFIRMED: [
        'IDENTITY_EXTRACTED',
        'IDENTITY_ABSENT',
        'IDENTITY_PARTIAL',
        'IDENTITY_CONFLICT'
    ],
    IDENTITY_EXTRACTED: [
        'REGISTRY_RECONCILED',
        'REGISTRY_ZERO_MATCH',
        'REGISTRY_MULTIPLE_MATCHES',
        'REGISTRY_FAILURE'
    ],
    REGISTRY_RECONCILED: [
        'READY_FOR_PROSPECT_CREATION',
        'EXISTING_PROSPECT'
    ]
};
function painFirstTransition(from, to, proof) {
    if (!transitions[from]?.includes(to)) throw new Error(`ILLEGAL_TRANSITION:${from}->${to}`);
    if (from === 'PAGE_OBSERVED') {
        if (!proof || !('preflight' in proof) || proof.preflight?.authority !== 'NON_AUTHORITATIVE') throw new Error('R42_PROOF_REQUIRED');
        const preflight = proof.preflight;
        const expected = preflight.state === 'LIKELY_CANONICAL_PAIN' && (preflight.condition === 'SITE_UNDER_CONSTRUCTION' || preflight.condition === 'SITE_REBUILDING') ? 'PAIN_SIGNAL_CONFIRMED' : preflight.state === 'NO_PAIN_SIGNAL' ? 'NO_PAIN_SIGNAL' : preflight.state === 'UNKNOWN' ? 'PAIN_UNKNOWN' : undefined;
        if (!expected || to !== expected) throw new Error('R42_RESULT_MISMATCH');
    }
    if (from === 'PAIN_SIGNAL_CONFIRMED') {
        if (!proof || !('identity' in proof) || !proof.identity || proof.identity.state === 'IDENTITY_STRONG' && !proof.identity.identity) throw new Error('IDENTITY_PROOF_REQUIRED');
        const expected = proof.identity.state === 'IDENTITY_STRONG' ? 'IDENTITY_EXTRACTED' : proof.identity.state;
        if (to !== expected) throw new Error('IDENTITY_RESULT_MISMATCH');
    }
    if (from === 'IDENTITY_EXTRACTED') {
        if (!proof || !('request' in proof) || !validRegistryReconciliationRequest(proof.request) || !validRegistryReconciliationResult(proof.result) || proof.request.candidateId !== proof.result.candidateId) throw new Error('REGISTRY_PROOF_REQUIRED');
        const expected = {
            UNIQUE_MATCH: 'REGISTRY_RECONCILED',
            ZERO_MATCH: 'REGISTRY_ZERO_MATCH',
            MULTIPLE_MATCHES: 'REGISTRY_MULTIPLE_MATCHES',
            PROVIDER_FAILURE: 'REGISTRY_FAILURE'
        }[proof.result.state];
        if (to !== expected) throw new Error('REGISTRY_RESULT_MISMATCH');
    }
    if (from === 'REGISTRY_RECONCILED' && (!proof || !('request' in proof) || typeof proof.existingProspect !== 'boolean' || !readyForProspectCreation(proof.request, proof.result, proof.factualOperatorName) || (proof.existingProspect ? to !== 'EXISTING_PROSPECT' : to !== 'READY_FOR_PROSPECT_CREATION'))) throw new Error('REGISTRY_PROOF_REQUIRED');
    return to;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/research/phone-extractor.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Pure deterministic phone extraction from already-fetched source material.
 *
 * SECURITY INVARIANT: MODEL CLAIM != SOURCE EVIDENCE.
 *
 * This module NEVER reads model-authored phone fields. It only parses raw fetched
 * content (document text / tel: hrefs / JSON-LD) that was independently observed
 * from a public source page. It performs NO LLM calls and invents no values.
 *
 * Evidence types (V1):
 *   TEL_HREF           — a tel: link found in fetched HTML
 *   JSON_LD_TELEPHONE — a JSON-LD structured-data telephone property
 *   VISIBLE_PAGE_TEXT  — a phone-shaped token found in visible page text
 *
 * Extraction priority is TEL_HREF > JSON_LD_TELEPHONE > VISIBLE_PAGE_TEXT.
 */ __turbopack_context__.s([
    "extractPhoneEvidence",
    ()=>extractPhoneEvidence,
    "extractPhoneFromJsonLd",
    ()=>extractPhoneFromJsonLd,
    "extractPhoneFromTelHrefs",
    ()=>extractPhoneFromTelHrefs,
    "extractPhoneFromVisibleText",
    ()=>extractPhoneFromVisibleText,
    "jsonLdBlocks",
    ()=>jsonLdBlocks,
    "looksLikePhone",
    ()=>looksLikePhone,
    "normalizePhoneDigits",
    ()=>normalizePhoneDigits
]);
function normalizePhoneDigits(raw) {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) return digits.slice(2);
    return digits;
}
function looksLikePhone(raw) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return false;
    if (!/^\+?[0-9][0-9\s().\-/]{7,20}$/.test(trimmed)) return false;
    const digits = normalizePhoneDigits(trimmed);
    if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
        return digits.length >= 8 && digits.length <= 15;
    }
    return digits.length === 10 && digits.startsWith('0');
}
/** Extract from a single tel: href value. */ function phoneFromTelHref(value) {
    const trimmed = value.trim();
    const candidate = trimmed.toLowerCase().startsWith('tel:') ? trimmed.slice(4).trim() : trimmed;
    if (!looksLikePhone(candidate)) return null;
    return candidate;
}
/** Extract telephone value from a parsed JSON-LD node. */ function phoneFromJsonLd(node) {
    if (typeof node === 'string') {
        const candidate = node.trim();
        return candidate ? candidate : null;
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
        const value = node['@value'];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
}
/** Walk a parsed JSON-LD value (object, array, scalar) for a telephone property. */ function collectJsonLdPhones(value, out) {
    if (Array.isArray(value)) {
        for (const item of value)collectJsonLdPhones(item, out);
        return;
    }
    if (!value || typeof value !== 'object') return;
    if (typeof value['telephone'] === 'string') {
        out.push(value['telephone']);
    }
    for (const child of Object.values(value)){
        if (child && typeof child === 'object') collectJsonLdPhones(child, out);
    }
}
function extractPhoneFromTelHrefs(html, sourceUrl) {
    const hrefMatches = html.matchAll(/href\s*=\s*["']\s*tel\s*:\s*([^"']+)["']/gi);
    for (const match of hrefMatches){
        const value = match[1]?.trim() ?? '';
        const phone = phoneFromTelHref(value);
        if (phone && looksLikePhone(phone)) {
            const normalizedDigits = normalizePhoneDigits(phone);
            if (normalizedDigits.length >= 8 && normalizedDigits.length <= 15) {
                return {
                    phone: phone.replace(/[^0-9+]/g, ''),
                    normalizedDigits,
                    sourceUrl,
                    evidenceType: 'TEL_HREF',
                    evidenceOrigin: 'FETCHED_SOURCE',
                    independentlyObserved: true
                };
            }
        }
    }
    return null;
}
function extractPhoneFromJsonLd(jsonLdText, sourceUrl) {
    let parsed;
    try {
        parsed = JSON.parse(jsonLdText);
    } catch  {
        return null;
    }
    const phones = [];
    collectJsonLdPhones(parsed, phones);
    for (const candidate of phones){
        if (looksLikePhone(candidate)) {
            const normalizedDigits = normalizePhoneDigits(candidate);
            if (normalizedDigits.length >= 8 && normalizedDigits.length <= 15) {
                return {
                    phone: candidate.replace(/[^0-9+]/g, ''),
                    normalizedDigits,
                    sourceUrl,
                    evidenceType: 'JSON_LD_TELEPHONE',
                    evidenceOrigin: 'FETCHED_SOURCE',
                    independentlyObserved: true
                };
            }
        }
    }
    return null;
}
/** Strip tags and decode a minimal set of HTML entities for visible-text scanning. */ function visibleText(html) {
    const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')// remove tel: anchors entirely (TEL_HREF is its own evidence type)
    .replace(/<a\b[^>]*href\s*=\s*["']\s*tel\s*:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, ' ');
    const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
    return withoutTags.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}
function extractPhoneFromVisibleText(html, sourceUrl) {
    const text = visibleText(html);
    const tokenMatches = text.match(/\+?\d[\d\s().\-/]{7,20}/g) ?? [];
    for (const token of tokenMatches){
        const trimmed = token.trim();
        if (!looksLikePhone(trimmed)) continue;
        const normalizedDigits = normalizePhoneDigits(trimmed);
        if (normalizedDigits.length >= 8 && normalizedDigits.length <= 15) {
            return {
                phone: trimmed,
                normalizedDigits,
                sourceUrl,
                evidenceType: 'VISIBLE_PAGE_TEXT',
                evidenceOrigin: 'FETCHED_SOURCE',
                independentlyObserved: true
            };
        }
    }
    return null;
}
function jsonLdBlocks(html) {
    const matches = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    return matches.map((block)=>{
        const m = block.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
        return m ? m[1].trim() : '';
    }).filter(Boolean);
}
function extractPhoneEvidence(html, sourceUrl) {
    if (!html) return null;
    const fromTel = extractPhoneFromTelHrefs(html, sourceUrl);
    if (fromTel) return fromTel;
    for (const block of jsonLdBlocks(html)){
        const fromJsonLd = extractPhoneFromJsonLd(block, sourceUrl);
        if (fromJsonLd) return fromJsonLd;
    }
    return extractPhoneFromVisibleText(html, sourceUrl);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/core/research/website-seed.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "extractSuppliedFirstPartyIdentity",
    ()=>extractSuppliedFirstPartyIdentity,
    "inspectSuppliedWebsiteSeed",
    ()=>inspectSuppliedWebsiteSeed,
    "validRegistration",
    ()=>validRegistration,
    "validateProviderDomain",
    ()=>validateProviderDomain
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/contact-acquisition/agent.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/core/research/evidence-integrity.ts [app-client] (ecmascript)");
;
;
function validateProviderDomain(value) {
    if (typeof value !== 'string') return null;
    const raw = value.trim().normalize('NFC').toLowerCase();
    if (!raw || /[\s/@:#?\\\[\]%]/u.test(raw) || raw.endsWith('.')) return null;
    try {
        const url = new URL(`https://${raw}/`);
        const host = url.hostname;
        const labels = host.split('.');
        if (host.length > 253 || labels.length < 2 || labels.some((label)=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || !/^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/.test(labels.at(-1)) || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host) || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$research$2f$evidence$2d$integrity$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["publicHttpUrl"])(url.href) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$core$2f$contact$2d$acquisition$2f$agent$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySourceType"])(url.href) !== 'OTHER_PUBLIC_SOURCE') return null;
        // WHATWG URL rejects malformed punycode; ASCII input must not be rewritten as an IP.
        if (/^[\x00-\x7F]+$/.test(raw) && raw !== host) return null;
        return host;
    } catch  {
        return null;
    }
}
const normalize = (value)=>value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const textValue = (value)=>typeof value === 'string' ? value.trim() : '';
const digits = (value)=>value.replace(/[\s.\-]/g, '');
function validRegistration(value, length) {
    const number = digits(value);
    if (!new RegExp(`^\\d{${length}}$`).test(number) || /^0+$/.test(number)) return false;
    let sum = 0;
    for(let i = number.length - 1; i >= 0; i--){
        let digit = Number(number[i]);
        if ((number.length - 1 - i) % 2) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }
    return sum % 10 === 0 && (length === 9 || validRegistration(number.slice(0, 9), 9));
}
const emptyBlock = ()=>({
        names: [],
        siren: [],
        siret: [],
        municipality: [],
        postcode: [],
        street: [],
        streetNumber: []
    });
function add(block, key, value) {
    const text = textValue(value);
    if (text && !block[key].includes(text)) block[key].push(text);
}
function address(block, street) {
    const text = textValue(street);
    const numbered = text.match(/^(\d+\s*(?:bis|ter|[a-z])?)\s+(.+)$/i);
    if (numbered) {
        add(block, 'streetNumber', numbered[1]);
        add(block, 'street', numbered[2]);
    } else add(block, 'street', text);
}
// Deliberately bounded valid schema.org types; unknown types yield insufficient evidence.
const operatorTypes = new Set([
    'Organization',
    'LocalBusiness',
    'Restaurant',
    'BarOrPub',
    'CafeOrCoffeeShop',
    'FoodEstablishment',
    'Bakery',
    'FastFoodRestaurant',
    'IceCreamShop',
    'Brewery',
    'Winery',
    'HealthAndBeautyBusiness',
    'BeautySalon',
    'HairSalon',
    'NailSalon',
    'DaySpa',
    'TattooParlor',
    'Store',
    'GroceryStore',
    'ConvenienceStore',
    'ClothingStore',
    'Florist',
    'AutoRepair',
    'HomeAndConstructionBusiness',
    'Electrician',
    'Plumber',
    'Locksmith',
    'GeneralContractor',
    'ProfessionalService',
    'LodgingBusiness',
    'Hotel',
    'RealEstateAgent',
    'Dentist',
    'MedicalBusiness'
]);
function jsonBlocks(value) {
    if (Array.isArray(value)) return value.flatMap(jsonBlocks);
    if (!value || typeof value !== 'object') return [];
    const object = value;
    // Only top-level nodes, never publisher, reviews, testimonials or related organizations.
    if (Array.isArray(object['@graph'])) return object['@graph'].flatMap(jsonBlocks);
    const types = Array.isArray(object['@type']) ? object['@type'] : [
        object['@type']
    ];
    if (!types.some((type)=>typeof type === 'string' && operatorTypes.has(type.replace(/^https?:\/\/schema\.org\//, '')))) return [];
    const block = emptyBlock();
    for (const key of [
        'name',
        'legalName',
        'alternateName'
    ])add(block, 'names', object[key]);
    for (const key of [
        'siren',
        'siret'
    ])add(block, key, object[key]);
    const identifiers = Array.isArray(object.identifier) ? object.identifier : [
        object.identifier
    ];
    for (const identifier of identifiers){
        if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
            const id = identifier;
            const label = normalize(textValue(id.propertyID) || textValue(id.name));
            if (label === 'siren' || label === 'siret') add(block, label, id.value);
        } else if (typeof identifier === 'string') {
            const match = identifier.match(/^\s*(SIREN|SIRET)\s*[:=]?\s*([\d .-]+)\s*$/i);
            if (match) add(block, match[1].toLowerCase(), match[2]);
        }
    }
    const addresses = Array.isArray(object.address) ? object.address : [
        object.address
    ];
    for (const item of addresses){
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const fields = item;
        add(block, 'municipality', fields.addressLocality);
        add(block, 'postcode', fields.postalCode);
        address(block, fields.streetAddress);
        add(block, 'streetNumber', fields.streetNumber);
    }
    return [
        block
    ];
}
function decodeText(text) {
    const entities = {
        amp: '&',
        nbsp: ' ',
        quot: '"',
        apos: "'",
        lt: '<',
        gt: '>',
        eacute: 'é',
        egrave: 'è',
        agrave: 'à',
        ccedil: 'ç'
    };
    return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity)=>{
        if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? original;
        const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : original;
    });
}
/** Inert, conservative tokenizer: no DOM, script execution, URL resolution or resource loading. */ function suppliedBlocks(html) {
    const root = {
        tag: 'root',
        attrs: {},
        children: []
    };
    const stack = [
        root
    ];
    let usable = true;
    const voidTags = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
    for (const token of html.matchAll(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]*>|[^<]+/gi)){
        const part = token[0];
        if (/^<!--|^<!/i.test(part)) continue;
        if (!part.startsWith('<')) {
            stack.at(-1).children.push(decodeText(part));
            continue;
        }
        const closing = part.match(/^<\/([\w-]+)\s*>$/);
        if (closing) {
            if (stack.at(-1)?.tag === closing[1].toLowerCase()) stack.pop();
            else usable = false;
            continue;
        }
        const opening = part.match(/^<([\w-]+)\b([^>]*?)>/);
        if (!opening) {
            usable = false;
            continue;
        }
        const node = {
            tag: opening[1].toLowerCase(),
            attrs: {},
            children: []
        };
        for (const attr of opening[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){
            const key = attr[1].toLowerCase();
            if (key in node.attrs) usable = false;
            node.attrs[key] = decodeText(attr[2] ?? attr[3] ?? attr[4] ?? '');
        }
        stack.at(-1).children.push(node);
        if (node.tag === 'script' || node.tag === 'style') {
            node.children.push(part.slice(opening[0].length).replace(/<\/(?:script|style)\s*>$/i, ''));
        } else if (!voidTags.test(node.tag) && !/\/\s*>$/.test(opening[0])) stack.push(node);
    }
    if (stack.length !== 1) usable = false;
    const excluded = (node)=>/^(?:iframe|object|template|noscript|blockquote|svg|math|style)$/i.test(node.tag) || 'hidden' in node.attrs || node.attrs['aria-hidden'] === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(node.attrs.style ?? '') || /credit|agency|agence|testimonial|temoignage|témoignage|review|widget|publisher|partner|partenaire/i.test(`${node.attrs.id ?? ''} ${node.attrs.class ?? ''} ${node.attrs.itemprop ?? ''}`);
    const visible = (node)=>excluded(node) || node.tag === 'script' ? '' : node.children.map((child)=>typeof child === 'string' ? child : visible(child)).join(' ') + (/^(?:p|li|dt|dd|div|section|address|h[1-6]|br)$/.test(node.tag) ? '\n' : '');
    const blocks = [];
    const walk = (node)=>{
        if (excluded(node)) return false;
        if (node.tag === 'script') {
            if (node.attrs.type?.toLowerCase() === 'application/ld+json') {
                try {
                    blocks.push(...jsonBlocks(JSON.parse(node.children.join(''))));
                } catch  {
                    usable = false;
                }
            }
            return false;
        }
        const nested = node.children.filter((child)=>typeof child !== 'string').map(walk).some(Boolean);
        const qualified = node.tag === 'footer' || node.tag === 'address' || /^(?:contact|legal|mentions-legales|business-identity)$/.test(node.attrs.id ?? '') || /(?:^|\s)(?:contact|legal|business-identity)(?:\s|$)/.test(node.attrs.class ?? '');
        if (qualified && !nested) {
            const block = emptyBlock();
            const labels = {
                nom: 'names',
                entreprise: 'names',
                'raison sociale': 'names',
                siren: 'siren',
                siret: 'siret',
                commune: 'municipality',
                ville: 'municipality',
                'code postal': 'postcode',
                rue: 'street',
                adresse: 'street',
                numero: 'streetNumber'
            };
            for (const line of visible(node).split(/[\n;|]/)){
                if (/site.*(?:concu|conçu|realise|réalisé|cree|créé)|powered by|designed by/i.test(line)) continue;
                const match = line.trim().match(/^([^:]+):\s*(.+)$/);
                const key = match && labels[normalize(match[1])];
                if (match && key) {
                    if (key === 'street') address(block, match[2]);
                    else add(block, key, match[2]);
                }
            }
            if (block.names.length) blocks.push(block);
        }
        return qualified || nested;
    };
    walk(root);
    return {
        blocks,
        usable
    };
}
function extractSuppliedFirstPartyIdentity(html) {
    if (typeof html !== 'string' || !html.trim()) return {
        state: 'IDENTITY_ABSENT'
    };
    const parsed = suppliedBlocks(html);
    if (!parsed.usable) return {
        state: 'IDENTITY_CONFLICT'
    };
    const blocks = parsed.blocks.filter((block)=>Object.values(block).some((values)=>values.length));
    if (!blocks.length) return {
        state: 'IDENTITY_ABSENT'
    };
    const facts = blocks.map((block)=>{
        const values = (key)=>[
                ...new Map(block[key].map((value)=>[
                        normalize(value),
                        value
                    ])).values()
            ];
        const names = values('names');
        const sirens = values('siren').map(digits);
        const sirets = values('siret').map(digits);
        const municipality = values('municipality');
        const postcode = values('postcode');
        const street = values('street');
        const streetNumber = values('streetNumber');
        const conflict = [
            names,
            sirens,
            sirets,
            municipality,
            postcode,
            street,
            streetNumber
        ].some((items)=>items.length > 1) || sirens.some((id)=>!validRegistration(id, 9)) || sirets.some((id)=>!validRegistration(id, 14)) || Boolean(sirens[0] && sirets[0] && sirets[0].slice(0, 9) !== sirens[0]);
        return {
            conflict,
            identity: {
                exactOperatorName: names[0],
                directSiren: sirens[0] ?? sirets[0]?.slice(0, 9),
                directSiret: sirets[0],
                municipality: municipality[0],
                postcode: postcode[0],
                street: street[0],
                streetNumber: streetNumber[0]
            }
        };
    });
    if (facts.some((item)=>item.conflict)) return {
        state: 'IDENTITY_CONFLICT'
    };
    const unique = [
        ...new Map(facts.map((item)=>[
                JSON.stringify(item.identity),
                item.identity
            ])).values()
    ];
    if (unique.length !== 1) return {
        state: 'IDENTITY_CONFLICT'
    };
    const identity = unique[0];
    const strong = Boolean(identity.directSiret || identity.directSiren && identity.exactOperatorName || identity.exactOperatorName && identity.postcode && (identity.municipality || identity.street));
    return {
        state: strong ? 'IDENTITY_STRONG' : 'IDENTITY_PARTIAL',
        identity
    };
}
function inspectSuppliedWebsiteSeed(input) {
    const { identity, providerResult: provider } = input;
    const base = {
        authority: 'NON_AUTHORITATIVE',
        provider: 'HUNTER_DOMAIN_FINDER',
        candidateIdentityKey: identity.candidateIdentityKey,
        providerLookupState: provider.state
    };
    if (provider.state !== 'CANDIDATE_DOMAIN') return {
        ...base,
        state: provider.state
    };
    const domain = validateProviderDomain(provider.domain);
    if (!domain || provider.candidateUrl !== `https://${domain}/` || provider.authority !== 'NON_AUTHORITATIVE' || provider.provider !== 'HUNTER_DOMAIN_FINDER') return {
        ...base,
        state: 'INVALID_PROVIDER_DOMAIN'
    };
    const insufficient = ()=>({
            ...base,
            state: 'FIRST_PARTY_IDENTITY_INSUFFICIENT'
        });
    if (typeof input.homepageHtml !== 'string' || !input.homepageHtml.trim() || !identity.candidateIdentityKey || !identity.factualNames?.length) return insufficient();
    if (identity.siren && identity.siret && digits(identity.siret).slice(0, 9) !== digits(identity.siren)) return insufficient();
    const parsed = suppliedBlocks(input.homepageHtml);
    const names = identity.factualNames.map(normalize).filter(Boolean);
    const matchesName = (block)=>block.names.some((name)=>names.includes(normalize(name)));
    const idMatch = (block)=>block.siret.some((id)=>digits(id) === identity.siret) || block.siren.some((id)=>digits(id) === identity.siren);
    // Do not merge across nodes, even when fields happen to be complementary.
    const relevant = parsed.blocks.filter((block)=>matchesName(block) || idMatch(block));
    const localKeys = [
        'municipality',
        'postcode',
        'street',
        'streetNumber'
    ];
    const conflict = (block)=>block.names.some((name)=>!names.includes(normalize(name))) || block.siret.some((id)=>!validRegistration(id, 14) || (identity.siret ? digits(id) !== identity.siret : Boolean(identity.siren && digits(id).slice(0, 9) !== identity.siren))) || block.siren.some((id)=>!validRegistration(id, 9) || (identity.siren ? digits(id) !== identity.siren : Boolean(identity.siret && digits(id) !== identity.siret.slice(0, 9)))) || localKeys.some((key)=>identity[key] && block[key].some((value)=>normalize(value) !== normalize(identity[key])));
    if (relevant.some(conflict)) return {
        ...base,
        state: 'FIRST_PARTY_IDENTITY_CONFLICT'
    };
    const distinct = [
        ...new Map(relevant.map((block)=>[
                JSON.stringify(Object.fromEntries(Object.entries(block).map(([key, values])=>[
                        key,
                        [
                            ...new Set(values.map(normalize))
                        ].sort()
                    ]))),
                block
            ])).values()
    ];
    if (!parsed.usable || distinct.length !== 1) return insufficient();
    const block = distinct[0];
    const fullAddress = localKeys.every((key)=>key === 'streetNumber' && !identity[key] || Boolean(identity[key] && block[key].length && block[key].every((value)=>normalize(value) === normalize(identity[key]))));
    let matchMethod;
    let matchedFields;
    if (identity.siret && validRegistration(identity.siret, 14) && block.siret.some((id)=>digits(id) === identity.siret)) {
        matchMethod = 'SIRET_EXACT_NAME';
        matchedFields = [
            'siret',
            'name'
        ];
    } else if (identity.siren && validRegistration(identity.siren, 9) && block.siren.some((id)=>digits(id) === identity.siren) && fullAddress) {
        matchMethod = 'SIREN_EXACT_LOCAL_IDENTITY';
        matchedFields = [
            'siren',
            'name',
            ...localKeys.filter((key)=>identity[key])
        ];
    } else if (!parsed.blocks.some((item)=>item.siren.length || item.siret.length) && fullAddress) {
        matchMethod = 'NAME_FULL_ADDRESS_EXACT';
        matchedFields = [
            'name',
            ...localKeys.filter((key)=>identity[key])
        ];
    } else return insufficient();
    if (!matchesName(block)) return insufficient();
    return {
        ...base,
        state: 'ACCEPTED_SEED',
        domain,
        candidateUrl: provider.candidateUrl,
        matchMethod,
        matchedFields,
        inspection: {
            kind: 'SUPPLIED_HOMEPAGE_HTML',
            characterCount: input.homepageHtml.length,
            operatorBlockCount: distinct.length
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_1h68or4._.js.map