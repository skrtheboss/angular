/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';

import {signal} from '../../src/signals';

describe('CheckAlways components', () => {
  it('can read a signal', () => {
    @Component({
      template: `{{value()}}`,
      standalone: true,
    })
    class CheckAlwaysCmp {
      value = signal('initial');
    }
    const fixture = TestBed.createComponent(CheckAlwaysCmp);
    const instance = fixture.componentInstance;

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toEqual('initial');

    fixture.componentInstance.value.set('new');
    fixture.detectChanges();
    expect(instance.value()).toBe('new');
  });

  it('is not "shielded" by a non-dirty OnPush parent', () => {
    const value = signal('initial');
    @Component({
      template: `{{value()}}`,
      standalone: true,
      selector: 'check-always',
    })
    class CheckAlwaysCmp {
      value = value;
    }
    @Component({
      template: `<check-always />`,
      standalone: true,
      imports: [CheckAlwaysCmp],
      changeDetection: ChangeDetectionStrategy.OnPush
    })
    class OnPushParent {
    }
    const fixture = TestBed.createComponent(OnPushParent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toEqual('initial');

    value.set('new');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('new');
  });
});


describe('OnPush components with signals', () => {
  it('marks view dirty', () => {
    @Component({
      template: `{{value()}}{{incrementTemplateExecutions()}}`,
      changeDetection: ChangeDetectionStrategy.OnPush,
      standalone: true,
    })
    class OnPushCmp {
      numTemplateExecutions = 0;
      value = signal('initial');
      incrementTemplateExecutions() {
        this.numTemplateExecutions++;
        return '';
      }
    }
    const fixture = TestBed.createComponent(OnPushCmp);
    const instance = fixture.componentInstance;

    fixture.detectChanges();
    expect(instance.numTemplateExecutions).toBe(1);
    expect(fixture.nativeElement.textContent.trim()).toEqual('initial');

    fixture.detectChanges();
    // Should not be dirty, should not execute template
    expect(instance.numTemplateExecutions).toBe(1);

    fixture.componentInstance.value.set('new');
    fixture.detectChanges();
    expect(instance.numTemplateExecutions).toBe(2);
    expect(instance.value()).toBe('new');
  });

  it('can read a signal in a host binding', () => {
    @Component({
      template: `{{incrementTemplateExecutions()}}`,
      selector: 'child',
      host: {'[class.blue]': 'useBlue()'},
      changeDetection: ChangeDetectionStrategy.OnPush,
      standalone: true,
    })
    class ChildCmp {
      useBlue = signal(false);

      numTemplateExecutions = 0;
      incrementTemplateExecutions() {
        this.numTemplateExecutions++;
        return '';
      }
    }

    @Component({
      template: `<child />`,
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [ChildCmp],
      standalone: true,
    })
    class ParentCmp {
    }
    const fixture = TestBed.createComponent(ParentCmp);
    const child = fixture.debugElement.query(p => p.componentInstance instanceof ChildCmp);
    const childInstance = child.componentInstance as ChildCmp;

    fixture.detectChanges();
    expect(childInstance.numTemplateExecutions).toBe(1);
    expect(child.nativeElement.outerHTML).not.toContain('blue');

    childInstance.useBlue.set(true);
    fixture.detectChanges();
    // We should not re-execute the child template. It didn't change, the host bindings did.
    expect(childInstance.numTemplateExecutions).toBe(1);
    expect(child.nativeElement.outerHTML).toContain('blue');
  });

  it('can have signals in both template and host bindings', () => {
    @Component({
      template: ``,
      selector: 'child',
      host: {'[class.blue]': 'useBlue()'},
      changeDetection: ChangeDetectionStrategy.OnPush,
      standalone: true,
    })
    class ChildCmp {
      useBlue = signal(false);
    }

    @Component({
      template: `<child /> {{parentSignalValue()}}`,
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [ChildCmp],
      standalone: true,
      selector: 'parent',
    })
    class ParentCmp {
      parentSignalValue = signal('initial');
    }

    // Wrapper component so we can effectively test ParentCmp being marked dirty
    @Component({
      template: `<parent />`,
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [ParentCmp],
      standalone: true,
    })
    class TestWrapper {
    }

    const fixture = TestBed.createComponent(TestWrapper);
    const parent = fixture.debugElement.query(p => p.componentInstance instanceof ParentCmp)
                       .componentInstance as ParentCmp;
    const child = fixture.debugElement.query(p => p.componentInstance instanceof ChildCmp)
                      .componentInstance as ChildCmp;

    fixture.detectChanges();
    expect(fixture.nativeElement.outerHTML).toContain('initial');
    expect(fixture.nativeElement.outerHTML).not.toContain('blue');

    child.useBlue.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.outerHTML).toContain('blue');

    // Set the signal in the parent again and ensure it gets updated
    parent.parentSignalValue.set('new');
    fixture.detectChanges();
    expect(fixture.nativeElement.outerHTML).toContain('new');

    // Set the signal in the child host binding again and ensure it is still updated
    child.useBlue.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.outerHTML).not.toContain('blue');
  });
});
