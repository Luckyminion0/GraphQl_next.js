import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  List,
  Button,
  Empty,
  Space,
  Avatar,
  Popconfirm,
  Notification,
  Divider,
  Tag,
} from "@arco-design/web-react";
import {
  IconEdit,
  IconDelete,
  IconNav,
  IconCalendarClock,
  IconCopy,
} from "@arco-design/web-react/icon";
import { useState, useEffect } from "react";
import {
  addGraph,
  delGraph,
  getAllGraphs,
  deleteAllGraphs,
  getAllApplications,
} from "../../data/db";
import ListNav from "../../components/list_nav";
import northwindTraders from "../../data/example/northwind_traders.json";
import blog from "../../data/example/blog.json";
import spaceX from "../../data/example/spacex.json";

import graphState from "../../hooks/use-graph-state";
import { Parser } from "@dbml/core";

const ImportModal = dynamic(() => import("../../components/import_modal"), {
  ssr: false,
});

/**
 * It fetches all the graphs from the database and displays them in a list
 * @returns Home component
 */
export default function Home() {
  const router = useRouter();
  const [graphs, setGraphs] = useState([]);
  const [showModal, setShowModal] = useState("");
  const { setTableDict, setLinkDict, tableList } = graphState.useContainer();
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const initGraphs = async () => {
      try {
        const data = await getAllGraphs();
        if (data && data.length) {
          data.sort((a, b) => b.createdAt - a.createdAt);
          setGraphs(data);
        }
      } catch (e) {
        console.log(e);
      }
    };
    initGraphs();
  }, []);

  useEffect(() => {
    const initApps = async () => {
      try {
        const data = await getAllApplications();

        if (data && data.length) {
          data.sort((a, b) => b.createdAt - a.createdAt);
          setApplications(data);
        }
      } catch (e) {
        console.log(e);
      }
    };
    initApps();
  }, []);

  const deleteGraph = async (id) => {
    await delGraph(id);
    setGraphs((state) => state.filter((item) => item.id !== id));
  };

  const handlerImportGraph = async ({ tableDict, linkDict }) => {
    const id = await addGraph({
      tableDict,
      linkDict,
      name: `Untitled graph ${graphs.length}`,
    });
    router.push(`/graphs/${id}`);
  };

  const handlerDeleteAllGraphs = async () => {
    const id = await deleteAllGraphs();
    setGraphs([]);
  };

  const handlerAddGraph = async () => {
    const id = await addGraph({ name: `Untitled graph ${graphs.length}` });
    router.push(`/graphs/${id}`);
  };

  const handlerDumpAsGraph = async () => {
    let value = "";
    try {
      const response = await fetch("..:4000/backend/index.php/api/mysqldump", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      value = data?.dumpSQL;
      // await window.navigator.clipboard.writeText(sqlValue);
      Notification.success({
        title: "Dump successfully.",
      });
    } catch (e) {
      console.log(e);
      Notification.error({
        title: "Database Error",
      });
    }
    try {
      const result = await Parser.parse(value, "mysql");
      const graph = result.schemas[0];
      const tableDict = {};
      const linkDict = {};
      const tables = [...tableList];
      graph.tables.forEach((table, index) => {
        const id = nanoid();
        const [x, y] = calcXY(0, tables);
        const newTable = {
          id,
          name: table.name,
          note: table.note,
          x,
          y,
          fields: table.fields.map((field) => {
            const fieldId = nanoid();
            return {
              id: fieldId,
              increment: field.increment,
              name: field.name,
              not_null: field.not_null,
              note: field.note,
              pk: field.pk,
              unique: field.unique,
              type: field.type.type_name.toUpperCase(),
            };
          }),
        };
        tableDict[id] = newTable;
        tables.push(newTable);
      });

      graph.refs.forEach((ref) => {
        const id = nanoid();
        linkDict[id] = {
          id,
          endpoints: ref.endpoints.map((endpoint) => {
            const table = Object.values(tableDict).find(
              (table) => table.name === endpoint.tableName
            );
            return {
              id: table.id,
              relation: endpoint.relation,
              fieldId: table.fields.find(
                (field) => field.name === endpoint.fieldNames[0]
              ).id,
            };
          }),
        };
      });

      setTableDict((state) => ({
        ...state,
        ...tableDict,
      }));
      setLinkDict((state) => ({
        ...state,
        ...linkDict,
      }));
    } catch (e) {
      console.log(e);
      Notification.error({
        title: "Parse failed",
      });
    }
  };

  const handlerAddExample = async () => {
    await Promise.all(
      [northwindTraders, blog, spaceX].map(({ id, ...item }) =>
        addGraph(item, id)
      )
    );
    setGraphs((state) => [northwindTraders, blog, spaceX, ...state]);
    Notification.success({
      title: "Sample data generated success.",
    });
  };

  return (
    <>
      <Head>
        <title>FastControl</title>
        <meta name="description" content="Web Application design tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <ListNav
        addGraph={() => handlerAddGraph()}
        dumpAsGraph={() => handlerDumpAsGraph()}
        importGraph={() => setShowModal("import")}
        deleteAllGraphs={() => handlerDeleteAllGraphs()}
        addExample={() => handlerAddExample()}
      />
      <div className="graph-container">
        {graphs && graphs.length ? (
          <List
            className="graph-list"
            size="large"
            header="Graphs"
            dataSource={graphs}
            render={(item, index) => (
              <List.Item
                key={item.id}
                extra={
                  <Space>
                    <Link href={`/graphs/${item.id}`}>
                      <Button type="primary" icon={<IconEdit />} />
                    </Link>
                    <Popconfirm
                      title="Are you sure to delete this graph?"
                      okText="Yes"
                      cancelText="No"
                      position="br"
                      onOk={() => deleteGraph(item.id)}
                    >
                      <Button
                        type="primary"
                        status="danger"
                        icon={<IconDelete />}
                      />
                    </Popconfirm>
                  </Space>
                }
              >
                <List.Item.Meta
                  avatar={<Avatar shape="square">{item.name[0]}</Avatar>}
                  title={item.name}
                  description={
                    <Space style={{ marginTop: 4 }}>
                      {item.tableDict ? (
                        <Tag color="arcoblue" icon={<IconNav />}>
                          {Object.keys(item.tableDict).length} tables
                        </Tag>
                      ) : null}
                      <Tag color="green" icon={<IconCopy />}>
                        createdAt {new Date(item.createdAt).toLocaleString()}
                      </Tag>
                      <Tag color="gold" icon={<IconCalendarClock />}>
                        updatedAt {new Date(item.updatedAt).toLocaleString()}
                      </Tag>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div className="graph-list-btns">
            <Button
              size="large"
              type="primary"
              onClick={() => handlerAddGraph()}
            >
              Create new graph now
            </Button>
            <Divider orientation="center">
              {" "}
              * Design database with FastControl *{" "}
            </Divider>
            {/* <Button size="large" type="outline" onClick={() => handlerAddExample()}>
                            Create new graph example
                        </Button> */}
          </div>
        )}
        {applications && applications.length ? (
          <List
            className="graph-list"
            size="large"
            header="Applications"
            dataSource={applications}
            render={(item, index) => (
              <List.Item
                key={item.id}
                extra={
                  <Space>
                    <Link href={`/applications/${item.id}`}>
                      <Button type="primary" icon={<IconEdit />} />
                    </Link>
                    <Popconfirm
                      title="Are you sure to delete this application?"
                      okText="Yes"
                      cancelText="No"
                      position="br"
                    >
                      <Button
                        type="primary"
                        status="danger"
                        icon={<IconDelete />}
                      />
                    </Popconfirm>
                  </Space>
                }
              >
                <List.Item.Meta
                  avatar={<Avatar shape="square">{item.name[0]}</Avatar>}
                  title={item.name}
                  description={
                    <Space style={{ marginTop: 4 }}>
                      {item.tableDict ? (
                        <Tag color="arcoblue" icon={<IconNav />}>
                          {Object.keys(item.tableDict).length} tables
                        </Tag>
                      ) : null}
                      <Tag color="green" icon={<IconCopy />}>
                        createdAt {new Date(item.createdAt).toLocaleString()}
                      </Tag>
                      <Tag color="gold" icon={<IconCalendarClock />}>
                        updatedAt {new Date(item.updatedAt).toLocaleString()}
                      </Tag>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div className="graph-list-btns">
            <Button size="large" type="primary" onClick={() => {}}>
              Create new Application now
            </Button>
            <Divider orientation="center">
              {" "}
              * Design database with FastControl *{" "}
            </Divider>
            {/* <Button size="large" type="outline" onClick={() => handlerAddExample()}>
                            Create new graph example
                        </Button> */}
          </div>
        )}
      </div>
      <ImportModal
        showModal={showModal}
        onCloseModal={() => setShowModal("")}
        cb={(args) => handlerImportGraph(args)}
      />
    </>
  );
}
