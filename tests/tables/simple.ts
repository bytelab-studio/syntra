import {Column, SQLType, table, Table} from "@bytelab.studio/syntra.plugin";

@table()
class CRUDTester extends Table {
    public constructor() {
        super();
    }

    public number: Column<number> = new Column(SQLType.INT);
}
