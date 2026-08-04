<?php declare(strict_types=1);

namespace ResourceTemplateTabs;

use Doctrine\DBAL\Connection;
use Omeka\Api\Exception\BadRequestException;

class TabManager
{
    private const MAX_GROUPS = 100;
    private const MAX_PROPERTIES = 5000;

    private Connection $connection;

    public function __construct(Connection $connection)
    {
        $this->connection = $connection;
    }

    public function getGroups(int $resourceTemplateId): array
    {
        $rows = $this->connection->executeQuery(
            'SELECT tab.id,
                    tab.label,
                    tab.position,
                    rtp.property_id
             FROM resource_template_tab tab
             LEFT JOIN resource_template_tab_property tab_property
                ON tab_property.tab_id = tab.id
             LEFT JOIN resource_template_property rtp
                ON rtp.id = tab_property.resource_template_property_id
             WHERE tab.resource_template_id = ?
             ORDER BY tab.position, tab_property.position',
            [$resourceTemplateId]
        )->fetchAllAssociative();

        $groups = [];
        foreach ($rows as $row) {
            $groupId = (int) $row['id'];
            if (!isset($groups[$groupId])) {
                $groups[$groupId] = [
                    'label' => $row['label'],
                    'property_ids' => [],
                ];
            }
            if ($row['property_id'] !== null) {
                $groups[$groupId]['property_ids'][] = (int) $row['property_id'];
            }
        }

        return array_values($groups);
    }

    public function normalisePayload($payload): array
    {
        if (is_string($payload)) {
            try {
                $payload = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $e) {
                throw new BadRequestException('The field tab configuration is invalid.');
            }
        }
        if (!is_array($payload) || count($payload) > self::MAX_GROUPS) {
            throw new BadRequestException('The field tab configuration is invalid.');
        }

        $normalised = [];
        $labels = [];
        $assignedPropertyIds = [];
        $propertyCount = 0;
        foreach ($payload as $group) {
            if (!is_array($group)) {
                throw new BadRequestException('The field tab configuration is invalid.');
            }
            $label = trim((string) ($group['label'] ?? ''));
            if ($label === '' || mb_strlen($label) > 190) {
                throw new BadRequestException('Every field tab must have a label of 190 characters or fewer.');
            }
            $labelKey = mb_strtolower($label);
            if (isset($labels[$labelKey])) {
                throw new BadRequestException('Field tab labels must be unique within a resource template.');
            }
            $labels[$labelKey] = true;

            $propertyIds = $group['property_ids'] ?? [];
            if (!is_array($propertyIds)) {
                throw new BadRequestException('The field tab configuration is invalid.');
            }
            $normalisedPropertyIds = [];
            foreach ($propertyIds as $propertyId) {
                $propertyId = (int) $propertyId;
                if ($propertyId < 1 || isset($assignedPropertyIds[$propertyId])) {
                    continue;
                }
                $assignedPropertyIds[$propertyId] = true;
                $normalisedPropertyIds[] = $propertyId;
                if (++$propertyCount > self::MAX_PROPERTIES) {
                    throw new BadRequestException('The field tab configuration contains too many properties.');
                }
            }

            $normalised[] = [
                'label' => $label,
                'property_ids' => $normalisedPropertyIds,
            ];
        }

        return $normalised;
    }

    public function saveGroups(int $resourceTemplateId, array $groups): void
    {
        $propertyRows = $this->connection->executeQuery(
            'SELECT id, property_id
             FROM resource_template_property
             WHERE resource_template_id = ?',
            [$resourceTemplateId]
        )->fetchAllAssociative();
        $templatePropertyIds = [];
        foreach ($propertyRows as $propertyRow) {
            $templatePropertyIds[(int) $propertyRow['property_id']]
                = (int) $propertyRow['id'];
        }

        $this->connection->transactional(function () use (
            $resourceTemplateId,
            $groups,
            $templatePropertyIds
        ): void {
            $this->connection->delete(
                'resource_template_tab',
                ['resource_template_id' => $resourceTemplateId]
            );

            foreach ($groups as $groupPosition => $group) {
                $this->connection->insert('resource_template_tab', [
                    'resource_template_id' => $resourceTemplateId,
                    'label' => $group['label'],
                    'position' => $groupPosition + 1,
                ]);
                $tabId = (int) $this->connection->lastInsertId();

                $propertyPosition = 1;
                foreach ($group['property_ids'] as $propertyId) {
                    if (!isset($templatePropertyIds[$propertyId])) {
                        continue;
                    }
                    $this->connection->insert('resource_template_tab_property', [
                        'tab_id' => $tabId,
                        'resource_template_property_id' => $templatePropertyIds[$propertyId],
                        'position' => $propertyPosition++,
                    ]);
                }
            }
        });
    }
}
