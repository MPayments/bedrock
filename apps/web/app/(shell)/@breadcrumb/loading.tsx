import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@multihansa/ui/components/breadcrumb";
import { Skeleton } from "@multihansa/ui/components/skeleton";

export default function BreadcrumbLoading() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <Skeleton className="h-4 w-24" />
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <Skeleton className="h-4 w-20" />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
