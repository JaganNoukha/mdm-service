export enum FieldType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    DATE = 'date',
    OBJECT = 'object',
    ARRAY = 'array',
    MASTER = 'master'
  }
  
  export enum RelationshipType {
    ONE_TO_ONE = 'oneToOne',
    ONE_TO_MANY = 'oneToMany',
    MANY_TO_ONE = 'manyToOne',
    MANY_TO_MANY = 'manyToMany'
  }