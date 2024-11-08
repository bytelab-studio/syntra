import {Table, table, Authentication, Relation1T1, ResourceColumn} from "@bytelab.studio/syntra.plugin";

@table()
class Person extends Table {
    public constructor() {
        super();
    }

    public readonly authentication: Relation1T1<typeof Authentication, Authentication> = new Relation1T1(Authentication);
    public readonly profilePicture: ResourceColumn = new ResourceColumn();
}