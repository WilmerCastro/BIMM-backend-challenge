import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Make', {
  description: 'A vehicle manufacturer from the NHTSA vPIC database.',
})
export class MakeObject {
  @Field(() => Int, { description: 'NHTSA make id.' })
  makeId: number;

  @Field({ description: 'Make name as published by NHTSA.' })
  makeName: string;
}

@ObjectType('PageInfo', { description: 'Where a page of results ends.' })
export class PageInfoObject {
  @Field({ description: 'Whether more results follow this page.' })
  hasNextPage: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'Pass as "after" to get the next page. Null when the page is empty.',
  })
  endCursor: string | null;
}

@ObjectType('MakeConnection', { description: 'A page of makes.' })
export class MakeConnectionObject {
  @Field(() => [MakeObject])
  nodes: MakeObject[];

  @Field(() => Int, {
    description: 'Makes matching the filters, across all pages.',
  })
  totalCount: number;

  @Field(() => PageInfoObject)
  pageInfo: PageInfoObject;
}
