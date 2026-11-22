/*!
 * PlanBraid - outlining, project tracking, and material orders.
 * Copyright (C) 2026 Robert Wasniowski
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Licensed under GNU AGPL version 3 or later; see LICENSE in the release root.
 * Distributed WITHOUT ANY WARRANTY, including MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
        const agendaSheetLimits = { rows: 20, columns: 10, cellLength: 200 };

        function validAgendaSheet(sheet) {
            return Array.isArray(sheet) && sheet.length > 0 && sheet.length <= agendaSheetLimits.rows &&
                Array.isArray(sheet[0]) && sheet[0].length > 0 && sheet[0].length <= agendaSheetLimits.columns &&
                Array.from(sheet).every(row => Array.isArray(row) && row.length === sheet[0].length &&
                    Array.from(row).every(cell => typeof cell === 'string' && cell.length <= agendaSheetLimits.cellLength && !/[\r\n]/.test(cell)));
        }

        function agendaSheetValues(sheet) {
            const column = letter => letter.charCodeAt(0) - 65;
            const number = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
            const address = /^[A-Z][1-9]\d*$/;
            const cache = new Map(), active = new Set();
            let depth = 0;
            const failure = code => { throw new AgendaFormulaError(code); };
            const coordinates = ref => {
                const row = Number(ref.slice(1)) - 1, col = column(ref[0]);
                if (!sheet[row] || col >= sheet[row].length) failure('#REF!');
                return [row, col];
            };
            const numeric = value => {
                if (typeof value === 'number') return value;
                const text = value.trim();
                if (!text) return 0;
                if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) failure('#VALUE!');
                return Number(text);
            };
            function value(row, col) {
                const raw = sheet[row][col];
                if (!raw.trimStart().startsWith('=')) return raw;
                const key = `${row}:${col}`;
                if (active.has(key)) failure('#CYCLE!');
                if (!cache.has(key)) {
                    active.add(key);
                    try {
                        const result = parse(raw.trimStart().slice(1).toUpperCase());
                        if (!Number.isFinite(result)) failure('#NUM!');
                        cache.set(key, result);
                    } catch (error) {
                        if (!(error instanceof AgendaFormulaError)) throw error;
                        cache.set(key, error);
                    } finally {
                        active.delete(key);
                    }
                }
                const result = cache.get(key);
                if (result instanceof AgendaFormulaError) throw result;
                return result;
            }
            function parse(source) {
                const tokens = source.match(/#REF!|[A-Z]+\d*|\d+(?:\.\d*)?|\.\d+|[+\-*/():,]|\S/g) || [];
                let i = 0;
                const take = token => tokens[i] === token && (++i > 0);
                const expect = token => { if (!take(token)) failure('#FORMULA!'); };
                function atom() {
                    if (depth >= 250) failure('#LIMIT!');
                    depth++;
                    try { return term(); } finally { depth--; }
                }
                function term() {
                    if (take('+')) return atom();
                    if (take('-')) return -atom();
                    if (take('(')) { const result = expression(); expect(')'); return result; }
                    const token = tokens[i++] || '';
                    if (token === '#REF!') failure(token);
                    if (number.test(token)) return Number(token);
                    if (address.test(token)) return numeric(value(...coordinates(token)));
                    if (!['SUM', 'AVERAGE', 'MIN', 'MAX'].includes(token)) failure('#FORMULA!');
                    expect('(');
                    const values = [];
                    do {
                        if (address.test(tokens[i] || '') && tokens[i + 1] === ':') {
                            const [r1, c1] = coordinates(tokens[i]);
                            const end = tokens[i + 2] || '';
                            if (!address.test(end)) failure('#FORMULA!');
                            const [r2, c2] = coordinates(end);
                            i += 3;
                            for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
                                for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
                                    const entry = value(r, c);
                                    if (typeof entry === 'number' || /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(entry.trim())) values.push(numeric(entry));
                                }
                            }
                        } else values.push(expression());
                    } while (take(','));
                    expect(')');
                    if (token === 'MIN') return values.reduce((min, item) => Math.min(min, item), values[0] ?? 0);
                    if (token === 'MAX') return values.reduce((max, item) => Math.max(max, item), values[0] ?? 0);
                    const total = values.reduce((sum, item) => sum + item, 0);
                    if (token === 'AVERAGE' && !values.length) failure('#DIV/0!');
                    return token === 'AVERAGE' ? total / values.length : total;
                }
                function product() {
                    let result = atom();
                    while (tokens[i] === '*' || tokens[i] === '/') {
                        const op = tokens[i++], right = atom();
                        if (op === '/' && right === 0) failure('#DIV/0!');
                        result = op === '*' ? result * right : result / right;
                    }
                    return result;
                }
                function expression() {
                    let result = product();
                    while (tokens[i] === '+' || tokens[i] === '-') {
                        const op = tokens[i++], right = product();
                        result = op === '+' ? result + right : result - right;
                    }
                    return result;
                }
                const result = expression();
                if (i !== tokens.length) failure('#FORMULA!');
                return result;
            }
            return sheet.map((row, r) => row.map((_, c) => {
                try {
                    const result = value(r, c);
                    return typeof result === 'number' ? String(Number(result.toPrecision(12))) : result;
                } catch (error) {
                    if (!(error instanceof AgendaFormulaError)) throw error;
                    return error.message;
                }
            }));
        }

        class AgendaFormulaError extends Error {}

        function removeAgendaSheetAxis(sheet, axis, index) {
            if (axis === 'row') sheet.splice(index, 1);
            else sheet.forEach(row => row.splice(index, 1));
            const position = ref => axis === 'row' ? Number(ref.slice(1)) - 1 : ref.toUpperCase().charCodeAt(0) - 65;
            const shifted = (ref, pos) => axis === 'row' ? `${ref[0]}${pos + 1}` :
                String.fromCharCode((ref[0] === ref[0].toLowerCase() ? 97 : 65) + pos) + ref.slice(1);
            const move = pos => pos - Number(pos > index);
            sheet.forEach(row => row.forEach((raw, c) => {
                if (!raw.trimStart().startsWith('=')) return;
                row[c] = raw.replace(/\b([A-J](?:20|1\d|[1-9]))\b(?:(\s*:\s*)([A-J](?:20|1\d|[1-9]))\b)?/gi,
                    (match, start, separator, end) => {
                        const a = position(start);
                        if (!end) return a === index ? '#REF!' : shifted(start, move(a));
                        const b = position(end);
                        if (a === index && b === index) return '#REF!';
                        return shifted(start, move(a === index ? a + Math.sign(b - a) : a)) + separator +
                            shifted(end, move(b === index ? b + Math.sign(a - b) : b));
                    });
            }));
        }

        function renderAgendaSheet(sheet, editing = false, onSelect) {
            const scroll = document.createElement('div');
            scroll.className = 'agenda-sheet-scroll';
            const table = document.createElement('table');
            table.className = 'agenda-sheet';
            table.setAttribute('aria-label', 'Note spreadsheet');
            const headers = table.createTHead().insertRow();
            headers.append(document.createElement('th'));
            const letters = sheet[0].map((_, c) => String.fromCharCode(65 + c));
            const heading = (row, label, scope) => {
                const th = document.createElement('th');
                th.scope = scope;
                th.textContent = label;
                row.append(th);
            };
            letters.forEach(letter => heading(headers, letter, 'col'));
            const body = table.createTBody();
            const results = [];
            sheet.forEach((row, r) => {
                const tr = body.insertRow();
                heading(tr, String(r + 1), 'row');
                results[r] = row.map((raw, c) => {
                    const cell = tr.insertCell();
                    if (!editing) return cell;
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.setAttribute('aria-label', `Cell ${letters[c]}${r + 1}`);
                    input.maxLength = agendaSheetLimits.cellLength;
                    input.value = raw;
                    input.onfocus = input.onclick = () => onSelect(r, c);
                    const result = document.createElement('small');
                    result.className = 'agenda-sheet-result';
                    input.oninput = () => { row[c] = input.value; recalculate(); };
                    cell.append(input, result);
                    return result;
                });
            });
            function recalculate() {
                agendaSheetValues(sheet).forEach((row, r) => row.forEach((value, c) => {
                    const output = results[r][c];
                    output.textContent = !editing || sheet[r][c].trimStart().startsWith('=') ? value : '';
                    if (editing) output.hidden = !output.textContent;
                }));
            }
            recalculate();
            scroll.append(table);
            return scroll;
        }

        function editAgendaSheet(host, savedSheet, onRemove) {
            let sheet = savedSheet ? savedSheet.map(row => [...row]) : null;
            let selectedRow = 0, selectedColumn = 0;
            const letter = c => String.fromCharCode(65 + c);
            function render(focusLabel) {
                host.replaceChildren();
                const controls = document.createElement('div');
                controls.className = 'agenda-sheet-controls';
                controls.setAttribute('role', 'group');
                controls.setAttribute('aria-label', 'Spreadsheet tools');
                const button = (label, icon, action, disabled = false) => {
                    const control = document.createElement('button');
                    control.type = 'button';
                    control.setAttribute('aria-label', label);
                    control.title = label;
                    control.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${icon}"/></svg>`;
                    control.disabled = disabled;
                    control.onclick = action;
                    controls.append(control);
                    return control;
                };
                if (!sheet) {
                    return;
                }
                button('Add row', 'M3 4h18v9H3zM3 8h18m-9 7v7m-3-3h6', () => {
                    sheet.push(sheet[0].map(() => ''));
                    render(`Cell A${sheet.length}`);
                }, sheet.length >= agendaSheetLimits.rows);
                button('Add column', 'M3 4h10v16H3zM8 4v16m10-12v8m-4-4h8', () => {
                    sheet.forEach(row => row.push(''));
                    render(`Cell ${String.fromCharCode(64 + sheet[0].length)}1`);
                }, sheet[0].length >= agendaSheetLimits.columns);
                function removeAxis(axis) {
                    const isRow = axis === 'row';
                    const index = isRow ? selectedRow : selectedColumn;
                    const label = isRow ? index + 1 : letter(index);
                    if (!confirm(`Remove ${axis} ${label}? Save the note to apply the change.`)) return;
                    const updated = sheet.map(row => [...row]);
                    removeAgendaSheetAxis(updated, axis, index);
                    if (!validAgendaSheet(updated)) {
                        showToast(`Could not remove ${axis} ${label}: a rewritten formula exceeds the cell length limit.`);
                        return;
                    }
                    sheet = updated;
                    selectedRow = Math.min(selectedRow, sheet.length - 1);
                    selectedColumn = Math.min(selectedColumn, sheet[0].length - 1);
                    render(`Cell ${letter(selectedColumn)}${selectedRow + 1}`);
                }
                const removeRow = button('Remove row', 'M3 4h18v9H3zM3 8h18m-12 11h6', () => removeAxis('row'), sheet.length === 1);
                const removeColumn = button('Remove column', 'M3 4h10v16H3zM8 4v16m6-8h8', () => removeAxis('column'), sheet[0].length === 1);
                button('Remove spreadsheet', 'M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v6m4-6v6', () => {
                    if (!confirm('Remove the spreadsheet from this note? Save the note to apply the change.')) return;
                    sheet = null;
                    render();
                    onRemove();
                });
                const hint = document.createElement('p');
                hint.className = 'agenda-sheet-hint';
                const selection = document.createElement('span');
                selection.className = 'agenda-sheet-selection';
                controls.append(selection);
                const select = (r, c) => {
                    selectedRow = r;
                    selectedColumn = c;
                    selection.textContent = `${letter(c)}${r + 1}`;
                    removeRow.title = `Remove row ${r + 1}`;
                    removeColumn.title = `Remove column ${letter(c)}`;
                };
                select(selectedRow, selectedColumn);
                hint.textContent = 'Use a formula like =SUM(A1:A3). Select a cell to remove its row or column.';
                host.append(controls, hint, renderAgendaSheet(sheet, true, select));
                if (focusLabel) host.querySelector(`[aria-label="${focusLabel}"]`)?.focus();
            }
            render();
            return {
                read: () => sheet,
                add() {
                    if (!sheet) {
                        sheet = Array.from({ length: 3 }, () => ['', '', '']);
                        render('Cell A1');
                    } else host.querySelector('input')?.focus();
                }
            };
        }
