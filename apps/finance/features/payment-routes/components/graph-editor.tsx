"use client";

import * as React from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
import type { PaymentRouteEditorState } from "../lib/state";
import {
  changeParticipantKind,
  insertIntermediateParticipant,
  removeIntermediateParticipant,
  setLegField,
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
  onStateChange: (state: PaymentRouteEditorState) => void;
  options: PaymentRouteConstructorOptions;
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

function RouteGraphNode({
  data,
  selected,
}: NodeProps) {
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
            <Button type="button" size="sm" variant="outline" onClick={nodeData.onInsertAfter}>
              <Plus className="size-4" />
              Узел после
            </Button>
          ) : null}
          {nodeData.canRemove ? (
            <Button type="button" size="sm" variant="outline" onClick={nodeData.onRemove}>
              <Trash2 className="size-4" />
              Удалить
            </Button>
          ) : null}
        </div>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-500" />
      <div
        className={`min-w-[220px] rounded-2xl border px-4 py-3 shadow-sm ${themeClassName}`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="font-medium">{nodeData.displayName}</div>
          <Badge variant="outline">
            {nodeData.role === "source"
              ? "Intake"
              : nodeData.role === "destination"
                ? "Beneficiary"
                : "Hop"}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">{nodeData.subtitle}</div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-500" />
    </>
  );
}

const nodeTypes = {
  routeParticipant: RouteGraphNode as React.ComponentType<any>,
};

function getLegCalculation(
  state: PaymentRouteEditorState,
  legId: string,
) {
  return state.calculation?.legs.find((leg) => leg.id === legId) ?? null;
}

function RouteGraphCanvas({
  onStateChange,
  options,
  state,
}: PaymentRouteGraphEditorProps) {
  const selection = state.selection;
  const nodes = React.useMemo<Node<RouteGraphNodeData>[]>(() => {
    return state.draft.participants.map((participant, index) => ({
      data: {
        canInsertAfter: index < state.draft.participants.length - 1,
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
        onRemove: () => onStateChange(removeIntermediateParticipant(state, index)),
        role:
          index === 0
            ? "source"
            : index === state.draft.participants.length - 1
              ? "destination"
              : "hop",
        subtitle:
          participant.kind === "customer"
            ? "Клиент"
            : participant.kind === "organization"
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
  }, [onStateChange, options, selection, state]);

  const edges = React.useMemo<Edge[]>(() => {
    return state.draft.legs.map((leg, index) => {
      const calculation = getLegCalculation(state, leg.id);

      return {
        animated: selection?.kind === "leg" && selection.legId === leg.id,
        data: {
          legId: leg.id,
        },
        id: leg.id,
        label: calculation
          ? `${formatCurrencyMinorAmount(
              calculation.netOutputMinor,
              options.currencies.find((currency) => currency.id === leg.toCurrencyId) ?? null,
            )}`
          : getLegKindLabel(leg.kind),
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        selected:
          selection?.kind === "leg" && selection.legId === leg.id,
        source: state.draft.participants[index]!.nodeId,
        target: state.draft.participants[index + 1]!.nodeId,
      };
    });
  }, [options.currencies, selection, state]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="h-[640px] overflow-hidden rounded-2xl border bg-slate-50">
        <ReactFlow
          fitView
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable
          edgesFocusable
          onNodeClick={(_, node) =>
            onStateChange(setSelection(state, { kind: "participant", nodeId: node.id }))
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
          <Background color="#d6dbe4" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <PaymentRouteGraphInspector
        onStateChange={onStateChange}
        options={options}
        state={state}
      />
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
            onKindChange={(kind) =>
              onStateChange(
                changeParticipantKind({
                  index: participantIndex,
                  kind,
                  options,
                  state,
                }),
              )
            }
            onEntityChange={(entityId) =>
              onStateChange(
                setParticipantOption({
                  entityId,
                  index: participantIndex,
                  kind: participant.kind,
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
    const legIndex = state.draft.legs.findIndex((leg) => leg.id === selection.legId);
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
              <SelectValue />
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
                  )} to ${formatCurrencyMinorAmount(
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
              const currentLeg = state.draft.legs.find((item) => item.id === leg.id);
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
                  fees: leg.fees.map((fee) => (fee.id === feeId ? updater(fee) : fee)),
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
        Выберите узел или ребро, чтобы отредактировать участника, операцию, валюты и комиссии.
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
