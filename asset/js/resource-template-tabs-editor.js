(function ($) {
    'use strict';

    $(function () {
        const editor = document.querySelector('#resource-template-tabs-editor');
        const sourceProperties = document.querySelector('ul#properties');
        const editSidebar = document.querySelector('#edit-sidebar');
        if (!editor || !sourceProperties || !editSidebar) {
            return;
        }

        const tabList = editor.querySelector('[data-tab-list]');
        const payloadInput = editor.querySelector('[data-tabs-payload]');
        const tabTemplate = editor.querySelector('[data-tab-template]');
        const otherFieldsLabel = editor.dataset.otherFieldsLabel;
        const fieldTabLabel = editor.dataset.fieldTabLabel;
        const tabPrefix = editor.dataset.tabPrefix;
        const assignments = new Map();
        let nextTabKey = 1;
        let activePropertyId = null;

        const sidebarOption = document.createElement('div');
        sidebarOption.className = 'option resource-template-tabs-sidebar-option';
        const sidebarLabel = document.createElement('label');
        sidebarLabel.htmlFor = 'resource-template-tab-assignment';
        const sidebarLabelText = document.createElement('span');
        sidebarLabelText.textContent = fieldTabLabel;
        const assignmentSelect = document.createElement('select');
        assignmentSelect.id = 'resource-template-tab-assignment';
        sidebarLabel.append(sidebarLabelText, assignmentSelect);
        sidebarOption.append(sidebarLabel);
        const sidebarOptions = editSidebar.querySelector('.field .option:last-child');
        if (sidebarOptions) {
            sidebarOptions.after(sidebarOption);
        } else {
            editSidebar.querySelector('.field')?.append(sidebarOption);
        }

        const getTabs = function () {
            return Array.from(tabList.querySelectorAll('[data-tab]'));
        };

        const getPropertyRows = function () {
            return Array.from(sourceProperties.querySelectorAll('.property.row[data-property-id]'));
        };

        const getTabByKey = function (key) {
            return getTabs().find(function (tab) {
                return tab.dataset.tabKey === key;
            }) || null;
        };

        const getTabLabel = function (key) {
            const tab = getTabByKey(key);
            return tab ? tab.querySelector('[data-tab-label]').value.trim() : '';
        };

        const refreshAssignmentSelect = function () {
            const selectedKey = activePropertyId
                ? (assignments.get(activePropertyId) || '')
                : '';
            assignmentSelect.replaceChildren();
            const unassignedOption = document.createElement('option');
            unassignedOption.value = '';
            unassignedOption.textContent = otherFieldsLabel;
            assignmentSelect.append(unassignedOption);
            getTabs().forEach(function (tab) {
                const option = document.createElement('option');
                option.value = tab.dataset.tabKey;
                option.textContent = tab.querySelector('[data-tab-label]').value.trim() || 'Untitled tab';
                assignmentSelect.append(option);
            });
            assignmentSelect.value = getTabByKey(selectedKey) ? selectedKey : '';
        };

        const refreshPropertyBadges = function () {
            getPropertyRows().forEach(function (row) {
                const propertyId = String(row.dataset.propertyId);
                let badge = row.querySelector('.resource-template-tab-assignment-cell');
                const tabLabel = getTabLabel(assignments.get(propertyId));
                if (!tabLabel) {
                    badge?.remove();
                    return;
                }
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'resource-template-tab-assignment-cell';
                    const actions = row.querySelector('.actions');
                    actions ? actions.before(badge) : row.append(badge);
                }
                badge.textContent = tabPrefix + ' ' + tabLabel;
            });
        };

        const serialise = function () {
            const propertyRows = getPropertyRows();
            const activePropertyIds = new Set(
                propertyRows
                    .filter(function (row) { return !row.classList.contains('delete'); })
                    .map(function (row) { return String(row.dataset.propertyId); })
            );
            const groups = getTabs().map(function (tab) {
                const tabKey = tab.dataset.tabKey;
                const propertyIds = propertyRows
                    .map(function (row) { return String(row.dataset.propertyId); })
                    .filter(function (propertyId) {
                        return activePropertyIds.has(propertyId)
                            && assignments.get(propertyId) === tabKey;
                    })
                    .map(Number);
                tab.querySelector('[data-tab-count]').textContent = propertyIds.length === 1
                    ? '1 field'
                    : propertyIds.length + ' fields';
                return {
                    label: tab.querySelector('[data-tab-label]').value.trim(),
                    property_ids: propertyIds,
                };
            });
            payloadInput.value = JSON.stringify(groups);
        };

        const refreshUi = function () {
            refreshAssignmentSelect();
            refreshPropertyBadges();
            serialise();
        };

        const createTab = function (group) {
            const tab = tabTemplate.content.firstElementChild.cloneNode(true);
            const tabKey = 'tab-' + nextTabKey++;
            tab.dataset.tabKey = tabKey;
            const labelInput = tab.querySelector('[data-tab-label]');
            labelInput.value = group?.label || '';
            labelInput.addEventListener('input', function () {
                labelInput.setCustomValidity('');
                refreshUi();
            });
            tab.querySelector('[data-remove-tab]').addEventListener('click', function () {
                assignments.forEach(function (assignedTabKey, propertyId) {
                    if (assignedTabKey === tabKey) {
                        assignments.delete(propertyId);
                    }
                });
                tab.remove();
                refreshUi();
            });
            tabList.append(tab);
            return tab;
        };

        let initialGroups = [];
        try {
            initialGroups = JSON.parse(editor.dataset.groups || '[]');
        } catch (error) {
            initialGroups = [];
        }
        initialGroups.forEach(function (group) {
            const tab = createTab(group);
            (group.property_ids || []).forEach(function (propertyId) {
                assignments.set(String(propertyId), tab.dataset.tabKey);
            });
        });

        editor.querySelector('[data-add-tab]').addEventListener('click', function () {
            const tab = createTab({label: '', property_ids: []});
            refreshUi();
            tab.querySelector('[data-tab-label]').focus();
        });

        sourceProperties.addEventListener('click', function (event) {
            if (!event.target.closest('.property-edit')) {
                return;
            }
            const propertyRow = event.target.closest('.property.row[data-property-id]');
            activePropertyId = propertyRow ? String(propertyRow.dataset.propertyId) : null;
            refreshAssignmentSelect();
        });

        editSidebar.querySelector('#set-changes')?.addEventListener('click', function () {
            if (!activePropertyId) {
                return;
            }
            if (assignmentSelect.value && getTabByKey(assignmentSelect.value)) {
                assignments.set(activePropertyId, assignmentSelect.value);
            } else {
                assignments.delete(activePropertyId);
            }
            refreshUi();
        });

        if (window.Sortable) {
            new Sortable(tabList, {
                draggable: '[data-tab]',
                handle: '.resource-template-tab-handle',
                onEnd: refreshUi,
            });
        }

        new MutationObserver(function () {
            const currentPropertyIds = new Set(getPropertyRows().map(function (row) {
                return String(row.dataset.propertyId);
            }));
            assignments.forEach(function (tabKey, propertyId) {
                if (!currentPropertyIds.has(propertyId)) {
                    assignments.delete(propertyId);
                }
            });
            refreshUi();
        }).observe(sourceProperties, {
            childList: true,
            attributes: true,
            attributeFilter: ['class'],
        });

        const form = editor.closest('form');
        form?.addEventListener('submit', function () {
            const labels = new Map();
            getTabs().forEach(function (tab) {
                const input = tab.querySelector('[data-tab-label]');
                const key = input.value.trim().toLocaleLowerCase();
                input.setCustomValidity(labels.has(key) ? 'Tab labels must be unique.' : '');
                labels.set(key, true);
            });
            serialise();
        });

        refreshUi();
    });
})(jQuery);
