"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";

import { BaseHandle } from "@/components/base-handle";
import {
  BaseNode,
  BaseNodeContent,
  BaseNodeHeader,
  BaseNodeHeaderTitle,
} from "@/components/base-node";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import {
  derivePaymentRouteLegSemantics,
  formatPaymentRouteLegSemantics,
} from "@bedrock/treasury/contracts";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import type {
  PaymentRouteGraphEdgeData,
  PaymentRouteGraphNodeData,
} from "../lib/graph-view-model";
import {
  buildPaymentRouteGraphEdges,
  buildPaymentRouteGraphNodes,
  getPaymentRouteLegCalculation,
} from "../lib/graph-view-model";
import { formatCurrencyMinorAmount } from "../lib/format";
import type { PaymentRouteConstructorOptions } from "../lib/queries";
import type { PaymentRouteEditorState } from "../lib/state";
import {
  changeParticipantKind,
  insertIntermediateParticipant,
  removeIntermediateParticipant,
  setLegField,
  setParticipantBinding,
  setParticipantOption,
  setParticipantRequisiteId,
  setSelection,
  setViewport,
  setVisualNodePosition,
} from "../lib/state";
import {
  CalculationHint,
  CurrencySelector,
  FeeListEditor,
  ParticipantRequisiteField,
  ParticipantSelector,
} from "./editor-shared";
import type { PaymentRouteRequisitesState } from "../lib/use-payment-route-requisites";
import { Separator } from "@bedrock/sdk-ui/components/separator";

type PaymentRouteGraphEditorProps = {
  canvasClassName?: string;
  className?: string;
  onStateChange: (state: PaymentRouteEditorState) => void;
  options: PaymentRouteConstructorOptions;
  requisites: PaymentRouteRequisitesState;
  sidebarChildren?: React.ReactNode;
  sidebarClassName?: string;
  state: PaymentRouteEditorState;
};

const RouteGraphNode = React.memo(function RouteGraphNode({
  data,
  dragging,
  selected,
}: NodeProps<Node<PaymentRouteGraphNodeData>>) {
  const nodeData = data;
  const themeClassName =
    nodeData.role === "source"
      ? "border-sky-300/80 bg-sky-50/95 hover:ring-sky-300"
      : nodeData.role === "destination"
        ? "border-emerald-300/80 bg-emerald-50/95 hover:ring-emerald-300"
        : "border-amber-300/80 bg-amber-50/95 hover:ring-amber-300";

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1 shadow-sm">
          {nodeData.canInsertAfter ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="nodrag"
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
              className="nodrag"
              onClick={nodeData.onRemove}
            >
              <Trash2 className="size-4" />
              Удалить
            </Button>
          ) : null}
        </div>
      </NodeToolbar>
      <BaseNode
        className={cn(
          "min-w-[280px] rounded-lg border shadow-sm transition-shadow",
          dragging && "shadow-xl ring-2 ring-sky-300/50",
          themeClassName,
        )}
      >
        <BaseNodeHeader className="gap-3 px-4 pb-1 pt-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center",
              nodeData.role === "source"
                ? "border-sky-200 text-sky-700"
                : nodeData.role === "destination"
                  ? "border-emerald-200 text-emerald-700"
                  : "border-amber-200 text-amber-700",
            )}
          >
            {nodeData.iconKind === "customer" ? (
              <UserRound className="size-7" />
            ) : nodeData.iconKind === "organization" ? (
              <Building2 className="size-7" />
            ) : nodeData.iconKind === "counterparty" ? (
              <BriefcaseBusiness className="size-7" />
            ) : (
              <CircleDollarSign className="size-7" />
            )}
          </div>
          <BaseNodeHeaderTitle className="min-w-0 truncate text-[15px] font-semibold">
            {nodeData.displayName}
          </BaseNodeHeaderTitle>
          <Badge variant="outline">
            {nodeData.role === "source"
              ? "Клиент"
              : nodeData.role === "destination"
                ? "Бенефициар"
                : "Промежуточный"}
          </Badge>
        </BaseNodeHeader>
        <BaseNodeContent className="pt-0">

          <Separator orientation="horizontal" className="h-px mx-[-12px]"/>
          <div className="space-y-2 pt-1">
            {nodeData.rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "relative rounded-lg border px-3 py-2 text-xs",
                  row.tone === "warning"
                    ? "border-amber-300/80 bg-amber-50/90"
                    : row.tone === "info"
                      ? "border-slate-200/80 bg-background/80"
                      : "border-slate-200/80 bg-background/85",
                )}
              >
                {row.active && row.handleId ? (
                  <BaseHandle
                    id={row.handleId}
                    type="target"
                    position={Position.Left}
                    className="!left-[-14px] !top-1/2 !h-3 !w-3 !-translate-y-1/2 !border-slate-400 !bg-background"
                  />
                ) : null}
                <div className="space-y-1">
                  <div
                    className={cn(
                      "truncate text-[12px] font-medium",
                      row.tone === "warning"
                        ? "text-amber-900"
                        : "text-foreground",
                    )}
                  >
                    {row.label}
                  </div>
                  {row.meta ? (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {row.meta}
                    </div>
                  ) : null}
                </div>
                {row.active && row.handleId ? (
                  <BaseHandle
                    id={row.handleId}
                    type="source"
                    position={Position.Right}
                    className="!right-[-14px] !top-1/2 !h-3 !w-3 !-translate-y-1/2 !border-slate-400 !bg-background"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </BaseNodeContent>
      </BaseNode>
    </>
  );
});

const RouteGraphEdge = React.memo(function RouteGraphEdge({
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
}: EdgeProps<Edge<PaymentRouteGraphEdgeData>>) {
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
});

const nodeTypes = {
  routeParticipant: RouteGraphNode as React.ComponentType<any>,
};

const edgeTypes = {
  routeLeg: RouteGraphEdge as React.ComponentType<any>,
};

function RouteGraphCanvas({
  canvasClassName,
  className,
  onStateChange,
  options,
  requisites,
  sidebarChildren,
  sidebarClassName,
  state,
}: PaymentRouteGraphEditorProps) {
  const selection = state.selection;
  const canInsertHop =
    options.organizations.length > 0 || options.counterparties.length > 0;
  const draggingNodeIdsRef = React.useRef(new Set<string>());
  const baseNodes = React.useMemo<Node<PaymentRouteGraphNodeData>[]>(() => {
    return buildPaymentRouteGraphNodes({
      canInsertHop,
      onInsertAfter: (index) =>
        onStateChange(
          insertIntermediateParticipant({
            afterLegIndex: Math.max(0, index),
            options,
            state,
          }),
        ),
      onRemove: (index) =>
        onStateChange(removeIntermediateParticipant(state, index)),
      options,
      requisitesByOwner: requisites.requisitesByOwner,
      selectedNodeId:
        selection?.kind === "participant" ? selection.nodeId : null,
      state,
    });
  }, [
    canInsertHop,
    onStateChange,
    options,
    requisites.requisitesByOwner,
    selection,
    state,
  ]);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<PaymentRouteGraphNodeData>>(baseNodes);

  React.useEffect(() => {
    setNodes((currentNodes) => {
      const currentNodeById = new Map(
        currentNodes.map((node) => [node.id, node] as const),
      );

      return baseNodes.map((node) => {
        const currentNode = currentNodeById.get(node.id);

        if (!currentNode || !draggingNodeIdsRef.current.has(node.id)) {
          return node;
        }

        return {
          ...node,
          dragging: currentNode.dragging,
          position: currentNode.position,
        };
      });
    });
  }, [baseNodes, setNodes]);

  const edges = React.useMemo<Edge<PaymentRouteGraphEdgeData>[]>(() => {
    return buildPaymentRouteGraphEdges({
      options,
      requisitesByOwner: requisites.requisitesByOwner,
      selectedLegId: selection?.kind === "leg" ? selection.legId : null,
      state,
    }).map((edge) => ({
      ...edge,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }));
  }, [options, requisites.requisitesByOwner, selection, state]);

  return (
    <div
      className={cn("grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]", className)}
    >
      <div
        className={cn(
          "h-[640px] overflow-hidden rounded-lg border bg-slate-50",
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
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) =>
            onStateChange(
              setSelection(state, { kind: "participant", nodeId: node.id }),
            )
          }
          onEdgeClick={(_, edge) =>
            onStateChange(setSelection(state, { kind: "leg", legId: edge.id }))
          }
          onPaneClick={() => onStateChange(setSelection(state, null))}
          onNodeDragStart={(_, node) => {
            draggingNodeIdsRef.current.add(node.id);
          }}
          onNodeDragStop={(_, node) => {
            draggingNodeIdsRef.current.delete(node.id);

            onStateChange(
              setVisualNodePosition({
                nodeId: node.id,
                position: node.position,
                state,
              }),
            );
          }}
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
          requisites={requisites}
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
  requisites,
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
          <ParticipantRequisiteField
            index={participantIndex}
            options={options}
            participant={participant}
            requisites={requisites}
            state={state}
            onChange={(requisiteId) =>
              onStateChange(
                setParticipantRequisiteId({
                  index: participantIndex,
                  requisiteId,
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
    const calculation = leg
      ? getPaymentRouteLegCalculation(state, leg.id)
      : null;

    if (!leg) {
      return null;
    }

    const semanticsLabel = formatPaymentRouteLegSemantics(
      derivePaymentRouteLegSemantics({
        draft: state.draft,
        legIndex,
      }),
    );

    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Инспектор шага</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-sm">
            <div className="font-medium">Семантика шага</div>
            <div className="text-muted-foreground">{semanticsLabel}</div>
          </div>
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
        Выберите узел или ребро, чтобы отредактировать участника, валюты и
        комиссии.
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
