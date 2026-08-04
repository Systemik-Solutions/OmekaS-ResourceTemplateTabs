# Resource Template Tabs

Resource Template Tabs lets administrators organize the properties of an Omeka S resource template into named, ordered field groups.

## Requirements

- Omeka S 4.x, version 4.1.1 or later

## Installation

The module directory must be named exactly `ResourceTemplateTabs`.

### Download

1. Download the module from the [GitHub repository](https://github.com/Systemik-Solutions/OmekaS-ResourceTemplateTabs).
2. Extract the downloaded archive into the `modules` directory of your Omeka S installation.
3. Rename the extracted directory to `ResourceTemplateTabs`. The resulting path should be:


### Git

Alternatively, clone the repository directly into the correctly named directory:

```sh
cd /path/to/omeka-s/modules
git clone https://github.com/Systemik-Solutions/OmekaS-ResourceTemplateTabs.git ResourceTemplateTabs
```

After installing the files, sign in to the Omeka S admin interface, open
**Modules**, and click **Install** for **Resource Template Tabs**.

## Current functionality

On a resource template edit page, the **Field tabs** editor allows an
administrator to:

- create, rename, remove, and reorder tabs;
- assign a tab from the **Field tab** selector in Omeka's normal property edit
  sidebar; and
- leave properties unassigned under **Other fields**.

The normal Omeka property list remains the source of field ordering. Removing a
tab does not remove any resource template properties: its fields return to
**Other fields**. Removing a property from the resource template automatically
removes its saved tab assignment.

On the admin resource template show page, configured groups appear as tabs
above Omeka's standard property table. An automatic **Other fields** tab keeps
unassigned properties accessible. Templates without configured groups retain
the normal Omeka display.

When editing an item that uses a grouped resource template, its native Omeka
property fields are organized under the saved tabs. Manual or unassigned
properties appear under **Other fields**. If the selected resource template is
changed during editing, the original layout is disabled instead of being
applied to the wrong template.

The admin item view uses the same tabs for populated values while preserving
Omeka's native value display, including resource links, annotations, locale
labels, and privacy indicators. Populated properties without a saved tab remain
available under **Other fields**.

Applying the saved tabs to the item add page is the next implementation step.

## Storage

The module creates two tables:

- `resource_template_tab`
- `resource_template_tab_property`

Both tables use cascading foreign keys to Omeka's resource template tables.
The module does not modify Omeka core tables.
