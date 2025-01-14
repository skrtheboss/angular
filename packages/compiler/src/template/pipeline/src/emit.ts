/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as o from '../../../../src/output/output_ast';
import {ConstantPool} from '../../../constant_pool';
import * as ir from '../ir';

import type {ComponentCompilation, ViewCompilation} from './compilation';

import {phaseConstCollection} from './phases/const_collection';
import {phaseEmptyElements} from './phases/empty_elements';
import {phaseGenerateAdvance} from './phases/generate_advance';
import {phaseReify} from './phases/reify';
import {phaseSlotAllocation} from './phases/slot_allocation';
import {phaseVarCounting} from './phases/var_counting';
import {phaseNaming} from './phases/naming';
import {phaseLocalRefs} from './phases/local_refs';
import {phaseGenerateVariables} from './phases/generate_variables';
import {phaseResolveNames} from './phases/resolve_names';
import {phaseResolveContexts} from './phases/resolve_contexts';

/**
 * Run all transformation phases in the correct order against a `ComponentCompilation`. After this
 * processing, the compilation should be in a state where it can be emitted via `emitTemplateFn`.s
 */
export function transformTemplate(cpl: ComponentCompilation): void {
  phaseGenerateVariables(cpl);
  phaseResolveNames(cpl);
  phaseResolveContexts(cpl);
  phaseLocalRefs(cpl);
  phaseEmptyElements(cpl);
  phaseConstCollection(cpl);
  phaseSlotAllocation(cpl);
  phaseVarCounting(cpl);
  phaseGenerateAdvance(cpl);
  phaseNaming(cpl);
  phaseReify(cpl);
}

/**
 * Compile all views in the given `ComponentCompilation` into the final template function, which may
 * reference constants defined in a `ConstantPool`.
 */
export function emitTemplateFn(tpl: ComponentCompilation, pool: ConstantPool): o.FunctionExpr {
  const rootFn = emitView(tpl.root);
  for (const view of tpl.views.values()) {
    if (view === tpl.root) {
      continue;
    }

    const viewFn = emitView(view);
    pool.statements.push(viewFn.toDeclStmt(viewFn.name!));
  }
  return rootFn;
}

/**
 * Emit a template function for an individual `ViewCompilation` (which may be either the root view
 * or an embedded view).
 */
function emitView(view: ViewCompilation): o.FunctionExpr {
  if (view.fnName === null) {
    throw new Error(`AssertionError: view ${view.xref} is unnamed`);
  }

  const createStatements: o.Statement[] = [];
  for (const op of view.create) {
    if (op.kind !== ir.OpKind.Statement) {
      throw new Error(`AssertionError: expected all create ops to have been compiled, but got ${
          ir.OpKind[op.kind]}`);
    }
    createStatements.push(op.statement);
  }
  const updateStatements: o.Statement[] = [];
  for (const op of view.update) {
    if (op.kind !== ir.OpKind.Statement) {
      throw new Error(`AssertionError: expected all update ops to have been compiled, but got ${
          ir.OpKind[op.kind]}`);
    }
    updateStatements.push(op.statement);
  }

  const rf = o.variable('rf');
  const createCond = o.ifStmt(
      new o.BinaryOperatorExpr(o.BinaryOperator.BitwiseAnd, rf, o.literal(1)), createStatements);
  const updateCond = o.ifStmt(
      new o.BinaryOperatorExpr(o.BinaryOperator.BitwiseAnd, rf, o.literal(2)), updateStatements);
  return o.fn(
      [
        new o.FnParam('rf'),
        new o.FnParam('ctx'),
      ],
      [createCond, updateCond], /* type */ undefined, /* sourceSpan */ undefined, view.fnName);
}
