<?php declare(strict_types=1);

namespace ResourceTemplateTabs\Service;

use Interop\Container\ContainerInterface;
use Laminas\ServiceManager\Factory\FactoryInterface;
use ResourceTemplateTabs\TabManager;

class TabManagerFactory implements FactoryInterface
{
    public function __invoke(
        ContainerInterface $services,
        $requestedName,
        ?array $options = null
    ): TabManager {
        return new TabManager($services->get('Omeka\Connection'));
    }
}
