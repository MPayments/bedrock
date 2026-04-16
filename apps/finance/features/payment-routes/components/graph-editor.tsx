"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
import type { PaymentRouteEditorState } from "../lib/state";
import {
  changeParticipantKind,
  insertIntermediateParticipant,
  removeIntermediateParticipant,
  setLegField,
  setParticipantBinding,
  setParticipantOption,
  setSelection,
  setViewport,
  setVisualNodePosition,
} from "../lib/state";
import { formatCurrencyMinorAmount } from "../lib/format";
import {
  CalculationHint,
  CurrencySelector,
  FeeListEditor,
  getLegKindLabel,
  ParticipantSelector,
} from "./editor-shared";

type PaymentRouteGraphEditorProps = {
  canvasClassName?: string;
  className?: string;
  onStateChange: (state: PaymentRouteEditorState) => void;
  options: PaymentRouteConstructorOptions;
  sidebarChildren?: React.ReactNode;
  sidebarClassName?: string;
  state: PaymentRouteEditorState;
};

type RouteGraphNodeData = {
  canInsertAfter: boolean;
  canRemove: boolean;
  displayName: string;
  onInsertAfter: () => void;
  onRemove: () => void;
  role: "destination" | "hop" | "source";
  subtitle: string;
};

type RouteGraphEdgeData = {
  amountLabel: string;
  feeLabel: string;
};

function RouteGraphNode({ data, selected }: NodeProps) {
  const nodeData = data as RouteGraphNodeData;
  const themeClassName =
    nodeData.role === "source"
      ? "border-sky-300 bg-sky-50"
      : nodeData.role === "destination"
        ? "border-emerald-300 bg-emerald-50"
        : "border-amber-300 bg-amber-50";

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1 shadow-sm">
          {nodeData.canInsertAfter ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={nodeData.onInsertAfter}
            >
              <Plus className="size-4" />
              Узел после
            </Button>
          ) : null}
          {nodeData.canRemove ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={nodeData.onRemove}
            >
              <Trash2 className="size-4" />
              Удалить
            </Button>
          ) : null}
        </div>
      </NodeToolbar>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-slate-500"
      />
      <div
        className={`min-w-[220px] rounded-2xl border px-4 py-3 shadow-sm ${themeClassName}`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="font-medium">{nodeData.displayName}</div>
          <Badge variant="outline">
            {nodeData.role === "source"
              ? "Клиент"
              : nodeData.role === "destination"
                ? "Бенефициар"
                : "Промежуточный"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">{nodeData.subtitle}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-slate-500"
      />
    </>
  );
}

function RouteGraphEdge({
  animated,
  data,
  interactionWidth,
  markerEnd,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<Edge<RouteGraphEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });

  const feeLabel = data?.feeLabel ?? "Комиссия: нет";
  const amountLabel = data?.amountLabel ?? "Сумма: —";

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth}
        style={{
          ...style,
          stroke: selected ? "#2563eb" : "#64748b",
          strokeDasharray: animated ? "6 6" : undefined,
          strokeWidth: selected ? 2.5 : 2,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <div
              title={feeLabel}
              className={cn(
                "max-w-[260px] text-[11px] font-medium leading-none whitespace-nowrap",
                selected ? "text-amber-800" : "text-muted-foreground",
              )}
            >
              {feeLabel}
            </div>
            <div
              title={amountLabel}
              className={cn(
                "max-w-[260px] text-[11px] font-semibold leading-none whitespace-nowrap",
                selected ? "text-sky-700" : "text-foreground",
              )}
            >
              {amountLabel}
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = {
  routeParticipant: RouteGraphNode as React.ComponentType<any>,
};

const edgeTypes = {
  routeLeg: RouteGraphEdge as React.ComponentType<any>,
};

function getLegCalculation(state: PaymentRouteEditorState, legId: string) {
  return state.calculation?.legs.find((leg) => leg.id === legId) ?? null;
}

function getCurrencyLabel(
  options: PaymentRouteConstructorOptions,
  currencyId: string,
) {
  return (
    options.currencies.find((currency) => currency.id === currencyId) ?? null
  );
}

function getEdgeAmountLabel(input: {
  calculation: ReturnType<typeof getLegCalculation>;
  leg: PaymentRouteEditorState["draft"]["legs"][number];
  options: PaymentRouteConstructorOptions;
}) {
  const { calculation, leg, options } = input;

  if (calculation) {
    return `Сумма: ${formatCurrencyMinorAmount(
      calculation.netOutputMinor,
      getCurrencyLabel(options, leg.toCurrencyId),
    )}`;
  }

  const fromCurrency = getCurrencyLabel(options, leg.fromCurrencyId);
  const toCurrency = getCurrencyLabel(options, leg.toCurrencyId);

  return `Сумма: ${fromCurrency?.code ?? "?"} → ${toCurrency?.code ?? "?"}`;
}

function getEdgeFeeLabel(input: {
  calculation: ReturnType<typeof getLegCalculation>;
  leg: PaymentRouteEditorState["draft"]["legs"][number];
  options: PaymentRouteConstructorOptions;
}) {
  const { calculation, leg, options } = input;

  const feeLabels = calculation
    ? calculation.fees.map((fee) => {
        const currency = getCurrencyLabel(options, fee.currencyId);
        const amount = formatCurrencyMinorAmount(fee.amountMinor, currency);

        if (fee.kind === "percent") {
          return `${fee.label ?? "Комиссия"} ${fee.percentage}% (${amount})`;
        }

        return `${fee.label ?? "Комиссия"} ${amount}`;
      })
    : leg.fees.map((fee) => {
        if (fee.kind === "percent") {
          return `${fee.label ?? "Комиссия"} ${fee.percentage}%`;
        }

        return `${fee.label ?? "Комиссия"} ${formatCurrencyMinorAmount(
          fee.amountMinor ?? "0",
          getCurrencyLabel(options, fee.currencyId ?? leg.fromCurrencyId),
        )}`;
      });

  return feeLabels.length > 0 ? feeLabels.join(" • ") : "Комиссия: нет";
}

function RouteGraphCanvas({
  canvasClassName,
  className,
  onStateChange,
  options,
  sidebarChildren,
  sidebarClassName,
  state,
}: PaymentRouteGraphEditorProps) {
  const selection = state.selection;
  const canInsertHop =
    options.organizations.length > 0 || options.counterparties.length > 0;
  const nodes = React.useMemo<Node<RouteGraphNodeData>[]>(() => {
    return state.draft.participants.map((participant, index) => ({
      data: {
        canInsertAfter:
          canInsertHop && index < state.draft.participants.length - 1,
        canRemove: index > 0 && index < state.draft.participants.length - 1,
        displayName: participant.displayName,
        onInsertAfter: () =>
          onStateChange(
            insertIntermediateParticipant({
              afterLegIndex: Math.max(0, index),
              options,
              state,
            }),
          ),
        onRemove: () =>
          onStateChange(removeIntermediateParticipant(state, index)),
        role: participant.role,
        subtitle:
          participant.binding === "abstract"
            ? participant.role === "source"
              ? "Клиент"
              : participant.role === "destination"
                ? "Бенефициар"
                : "Промежуточный"
            : participant.entityKind === "customer"
              ? "Клиент"
              : participant.entityKind === "organization"
              ? "Организация"
              : "Контрагент",
      },
      id: participant.nodeId,
      position: state.visual.nodePositions[participant.nodeId] ?? {
        x: index * 260,
        y: index % 2 === 0 ? 72 : 180,
      },
      selected:
        selection?.kind === "participant" &&
        selection.nodeId === participant.nodeId,
      type: "routeParticipant",
    }));
  }, [canInsertHop, onStateChange, options, selection, state]);

  const edges = React.useMemo<Edge<RouteGraphEdgeData>[]>(() => {
    return state.draft.legs.map((leg, index) => {
      const calculation = getLegCalculation(state, leg.id);

      return {
        animated: selection?.kind === "leg" && selection.legId === leg.id,
        data: {
          amountLabel: getEdgeAmountLabel({
            calculation,
            leg,
            options,
          }),
          feeLabel: getEdgeFeeLabel({
            calculation,
            leg,
            options,
          }),
          legId: leg.id,
        },
        id: leg.id,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        selected: selection?.kind === "leg" && selection.legId === leg.id,
        source: state.draft.participants[index]!.nodeId,
        target: state.draft.participants[index + 1]!.nodeId,
        type: "routeLeg",
      };
    });
  }, [options, selection, state]);

  return (
    <div
      className={cn("grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]", className)}
    >
      <div
        className={cn(
          "h-[640px] overflow-hidden rounded-2xl border bg-slate-50",
          canvasClassName,
        )}
      >
        <ReactFlow
          fitView
          nodes={nodes}
          edges={edges}
          edgeTypes={edgeTypes}
          nodeTypes={nodeTypes}
          nodesDraggable
          edgesFocusable
          onNodeClick={(_, node) =>
            onStateChange(
              setSelection(state, { kind: "participant", nodeId: node.id }),
            )
          }
          onEdgeClick={(_, edge) =>
            onStateChange(setSelection(state, { kind: "leg", legId: edge.id }))
          }
          onPaneClick={() => onStateChange(setSelection(state, null))}
          onNodeDragStop={(_, node) =>
            onStateChange(
              setVisualNodePosition({
                nodeId: node.id,
                position: node.position,
                state,
              }),
            )
          }
          onMoveEnd={(_, viewport) =>
            onStateChange(
              setViewport({
                state,
                viewport,
              }),
            )
          }
        >
          <Background
            color="#cbd5e1"
            gap={22}
            size={1.6}
            variant={BackgroundVariant.Dots}
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className={cn("space-y-4", sidebarClassName)}>
        <PaymentRouteGraphInspector
          onStateChange={onStateChange}
          options={options}
          state={state}
        />
        {sidebarChildren}
      </div>
    </div>
  );
}

function PaymentRouteGraphInspector({
  onStateChange,
  options,
  state,
}: PaymentRouteGraphEditorProps) {
  const selection = state.selection;

  if (selection?.kind === "participant") {
    const participantIndex = state.draft.participants.findIndex(
      (participant) => participant.nodeId === selection.nodeId,
    );
    const participant = state.draft.participants[participantIndex];

    if (!participant || participantIndex < 0) {
      return null;
    }

    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Инспектор узла</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ParticipantSelector
            index={participantIndex}
            options={options}
            participant={participant}
            state={state}
            onBindingChange={(binding) =>
              onStateChange(
                setParticipantBinding({
                  binding,
                  index: participantIndex,
                  options,
                  state,
                }),
              )
            }
            onKindChange={(entityKind) =>
              onStateChange(
                changeParticipantKind({
                  entityKind,
                  index: participantIndex,
                  options,
                  state,
                }),
              )
            }
            onEntityChange={(entityId) =>
              onStateChange(
                setParticipantOption({
                  entityId,
                  entityKind:
                    participant.entityKind === null
                      ? participant.role === "source"
                        ? "customer"
                        : "organization"
                      : participant.entityKind,
                  index: participantIndex,
                  options,
                  state,
                }),
              )
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (selection?.kind === "leg") {
    const legIndex = state.draft.legs.findIndex(
      (leg) => leg.id === selection.legId,
    );
    const leg = state.draft.legs[legIndex];
    const calculation = leg ? getLegCalculation(state, leg.id) : null;

    if (!leg) {
      return null;
    }

    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Инспектор шага</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={leg.kind}
            onValueChange={(kind) => {
              if (!kind) {
                return;
              }

              onStateChange(
                setLegField(state, leg.id, {
                  kind: kind as typeof leg.kind,
                }),
              );
            }}
          >
            <SelectTrigger aria-label="Тип операции">
              <SelectValue>{getLegKindLabel(leg.kind)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  "collect",
                  "exchange",
                  "transfer",
                  "intercompany",
                  "cross_company",
                  "payout",
                ] as const
              ).map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {getLegKindLabel(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <CurrencySelector
              ariaLabel="Валюта входа"
              options={options}
              value={leg.fromCurrencyId}
              onChange={(currencyId) =>
                onStateChange(
                  setLegField(state, leg.id, {
                    fromCurrencyId: currencyId,
                  }),
                )
              }
            />
            <CurrencySelector
              ariaLabel="Валюта выхода"
              options={options}
              value={leg.toCurrencyId}
              onChange={(currencyId) =>
                onStateChange(
                  setLegField(state, leg.id, {
                    toCurrencyId: currencyId,
                  }),
                )
              }
            />
          </div>
          <CalculationHint
            text={
              calculation
                ? `${formatCurrencyMinorAmount(
                    calculation.inputAmountMinor,
                    options.currencies.find(
                      (currency) => currency.id === leg.fromCurrencyId,
                    ) ?? null,
                  )} → ${formatCurrencyMinorAmount(
                    calculation.netOutputMinor,
                    options.currencies.find(
                      (currency) => currency.id === leg.toCurrencyId,
                    ) ?? null,
                  )}`
                : null
            }
          />
          <FeeListEditor
            fallbackCurrencyId={leg.fromCurrencyId}
            fees={leg.fees}
            options={options}
            onAdd={() => {
              const currentLeg = state.draft.legs.find(
                (item) => item.id === leg.id,
              );
              if (!currentLeg) {
                return;
              }

              onStateChange(
                setLegField(state, leg.id, {
                  fees: [
                    ...currentLeg.fees,
                    {
                      amountMinor: "100",
                      currencyId: leg.fromCurrencyId,
                      id: `route-fee-${crypto.randomUUID()}`,
                      kind: "fixed",
                      label: "Комиссия",
                    },
                  ],
                }),
              );
            }}
            onRemove={(feeId) =>
              onStateChange(
                setLegField(state, leg.id, {
                  fees: leg.fees.filter((fee) => fee.id !== feeId),
                }),
              )
            }
            onChange={(feeId, updater) =>
              onStateChange(
                setLegField(state, leg.id, {
                  fees: leg.fees.map((fee) =>
                    fee.id === feeId ? updater(fee) : fee,
                  ),
                }),
              )
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Инспектор графа</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Выберите узел или ребро, чтобы отредактировать участника, операцию,
        валюты и комиссии.
      </CardContent>
    </Card>
  );
}

export function PaymentRouteGraphEditor(props: PaymentRouteGraphEditorProps) {
  return (
    <ReactFlowProvider>
      <RouteGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
